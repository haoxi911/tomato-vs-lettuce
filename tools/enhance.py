import cv2, numpy as np
from PIL import Image

def enhance(rgb, gamma=0.58, floor=0.010, preblur=0.7,
            unsharp_amt=0.5, unsharp_r=1.2, csat=1.40):
    src = rgb.astype(np.uint8)
    lab = cv2.cvtColor(src, cv2.COLOR_RGB2LAB).astype(np.float32)
    L, a, b = lab[...,0].copy(), lab[...,1]-128, lab[...,2]-128
    a = cv2.medianBlur(a,5); b = cv2.medianBlur(b,5)
    C = np.sqrt(a*a+b*b)

    # --- 彩色区域：把成片的彩笔整块认出来，并把色相补到块内偏灰的像素上 ---
    conf = np.clip((C-6.0)/7.0, 0, 1).astype(np.float32)      # 可信彩色像素
    K = (61,61)
    num_a = cv2.boxFilter(a*conf, -1, K); num_b = cv2.boxFilter(b*conf, -1, K)
    den   = cv2.boxFilter(conf,   -1, K) + 1e-4
    a_fill, b_fill = num_a/den, num_b/den
    cover = cv2.boxFilter(conf, -1, K)                        # 附近彩色像素密度
    m = np.clip((cover-0.04)/0.12, 0, 1)                      # 区域级彩色权重
    m = cv2.GaussianBlur(m,(0,0),3.0)
    mn = src.min(axis=2).astype(np.float32)             # 任一通道变暗 = 有笔迹（黄色也算）
    ink = np.clip(np.maximum((250.0-mn)/10.0, (C-4.0)/8.0), 0, 1)
    a = (a*conf + a_fill*(1-conf))*m*csat*ink
    b = (b*conf + b_fill*(1-conf))*m*csat*ink
    m = m*ink

    # --- 铅笔：压平纸张 + 提升淡痕 ---
    l8 = cv2.bilateralFilter(L.astype(np.uint8), 5, 20, 5)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(61,61))
    bg = cv2.GaussianBlur(cv2.morphologyEx(l8, cv2.MORPH_CLOSE, k),(0,0),21).astype(np.float32)/255.
    f = np.clip(l8.astype(np.float32)/255./np.clip(bg,0.55,1.0), 0, 1)
    d = 1.0-f
    if preblur>0: d = cv2.GaussianBlur(d,(0,0),preblur)*1.35
    d = np.clip((d-floor)/(1-floor), 0, 1)**gamma
    Lb = np.clip(1.0-d,0,1)*255.

    Lout = np.clip(Lb*(1-m) + np.clip(L*0.95,0,255)*m, 0, 255)/255.
    if unsharp_amt>0:
        Lout = np.clip(Lout + unsharp_amt*(Lout-cv2.GaussianBlur(Lout,(0,0),unsharp_r)),0,1)
    lab2 = np.stack([Lout*255, np.clip(a+128,0,255), np.clip(b+128,0,255)],-1).astype(np.uint8)
    return cv2.cvtColor(lab2, cv2.COLOR_LAB2RGB)

if __name__=='__main__':
    im=np.array(Image.open('/mnt/user-data/outputs/03-大爆炸.jpg').convert('RGB'))
    H,W=im.shape[:2]
    crops=[(int(W*0.02),int(H*0.55),760,470),(int(W*0.20),int(H*0.04),760,470),(int(W*0.72),int(H*0.05),760,470)]
    rows=[]
    for x,y,w_,h in crops:
        c=im[y:y+h, x:x+w_]
        rows.append(np.hstack([c, enhance(c,gamma=0.70), enhance(c,gamma=0.58), enhance(c,gamma=0.46)]))
    Image.fromarray(np.vstack(rows)).save('cmp4.png'); print('ok')
