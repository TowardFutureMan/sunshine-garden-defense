#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 9 份切帧 JSON 生成 js/sheet-data.js。
游戏在 file:// 双击打开时 fetch 会被浏览器拦截, 所以把帧数据编译成 JS 常量。
射手炮口从图集第 0 帧实测(暗色炮孔连通域), 不靠静态设计图估算。
用法: python3 test/gen-sheet-data.py
"""
import json
import os
import numpy as np
from PIL import Image


def label_components(mask):
    """四连通标记；小范围炮孔检测无需额外安装 scipy。"""
    labels = np.zeros(mask.shape, dtype=np.int32)
    height, width = mask.shape
    count = 0
    for y, x in zip(*np.where(mask)):
        if labels[y, x]:
            continue
        count += 1
        labels[y, x] = count
        pending = [(int(y), int(x))]
        while pending:
            cy, cx = pending.pop()
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = count
                    pending.append((ny, nx))
    return labels, count

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SHEETS = {
    'peashooter': ('assets/plants/peashooter-idle-v3-8f', 'peashooter-sway-blink-8f-v3.json', 1),
    'sunflower': ('assets/plants/sunflower-idle-v1-8f', 'sunflower-sway-blink-8f-v1.json', 0),
    'wallnut': ('assets/plants/wallnut-idle-v1-8f', 'wallnut-rolypoly-blink-8f-v1.json', 0),
    'snowpea': ('assets/plants/snowpea-idle-v1-8f', 'snowpea-sway-blink-8f-v1.json', 1),
    'cherrybomb': ('assets/plants/cherrybomb-idle-v1-8f', 'cherrybomb-sway-blink-8f-v1.json', 0),
    'repeater': ('assets/plants/repeater-idle-v1-8f', 'repeater-sway-blink-8f-v1.json', 2),
    'potatomine': ('assets/plants/potatomine-idle-v1-8f', 'potatomine-bounce-blink-8f-v1.json', 0),
    'shovel': ('assets/tools/shovel-idle-v1-8f', 'shovel-wobble-8f-v1.json', 0),
    'mower': ('assets/tools/mower-idle-v1-8f', 'mower-idle-spin-8f-v1.json', 0),
}


def measure_mouths(png_path, rect, pivot, scale, want):
    """在帧0右上部找暗色炮孔连通域, 返回 [[dx,dy],...] (游戏px, 相对pivot)。"""
    if want <= 0:
        return []
    im = np.asarray(Image.open(png_path).convert('RGBA')).astype(int)
    x0, y0, w, h = rect
    reg = im[y0:y0 + int(h * 0.55), x0 + int(w * 0.70):x0 + w]
    r, g, b, a = reg[:, :, 0], reg[:, :, 1], reg[:, :, 2], reg[:, :, 3]
    dark = (a > 200) & (r < 110) & (g < 120) & (b < 120)
    lab, n = label_components(dark)
    blobs = []
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < 100:
            continue
        yy, xx = np.where(m)
        blobs.append((xx.mean() + x0 + int(w * 0.70), yy.mean() + y0, int(m.sum())))
    if not blobs:
        return []
    # 炮孔是最右侧的大块; 双发取最右两个并按 y 排序(上口为 index0)
    blobs.sort(key=lambda t: -t[0])
    picked = blobs[:want]
    picked.sort(key=lambda t: t[1])
    return [[round((cx - pivot[0]) * scale, 1), round((cy - pivot[1]) * scale, 1)]
            for cx, cy, _ in picked]


def main():
    data = {}
    for key, (d, jf, mouths) in SHEETS.items():
        doc = json.load(open(os.path.join(ROOT, d, jf), encoding='utf-8'))
        # 豌豆 v3 的原始 JSON 来自逐帧预览，pivot 是帧内坐标。
        # 其他资产的 pivot 已是图集全局坐标，运行时 drawSheet 统一接收后者。
        frames = []
        for f in doc['frames']:
            pivot = list(f['pivot'])
            if key == 'peashooter':
                pivot = [f['rect'][0] + pivot[0], f['rect'][1] + pivot[1]]
            frames.append({'rect': f['rect'], 'pivot': pivot})
        f0 = frames[0]
        png = os.path.join(ROOT, d, doc['image'])
        entry = {
            'src': d + '/' + doc['image'],
            'scale': round(doc.get('renderScale') or 0.2, 4),
            'fps': (doc.get('playback') or {}).get('fps', 7),
            'frames': frames,
            'pivotSpace': 'sheet',
        }
        if mouths:
            entry['mouths'] = measure_mouths(png, f0['rect'], f0['pivot'], entry['scale'], mouths)
        data[key] = entry
        mk = entry.get('mouths')
        print(f"{key:11s} scale={entry['scale']} fps={entry['fps']} 帧={len(entry['frames'])}"
              + (f" 炮口={mk}" if mk else ""))

    lines = [
        '/* 序列帧数据(由 test/gen-sheet-data.py 从各资产目录切帧 JSON 生成, 请勿手改)。',
        ' * file:// 双击打开时 fetch 会被拦截, 故编译为 JS 常量; 改 JSON 后需重新生成。 */',
        '(function (root) {',
        "  'use strict';",
        '  root.GardenGame = root.GardenGame || {};',
        '  root.GardenGame.SHEET_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';',
        '})(typeof window !== \'undefined\' ? window : globalThis);',
        '',
    ]
    out = os.path.join(ROOT, 'js', 'sheet-data.js')
    open(out, 'w', encoding='utf-8').write('\n'.join(lines))
    print('written:', out, f'({os.path.getsize(out)} bytes)')


if __name__ == '__main__':
    main()
