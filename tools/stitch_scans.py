import cv2, numpy as np, os
from PIL import Image, ImageOps

D='/root/.claude/uploads/27a4b9c7-7fb7-5cb4-a3c5-b75e7e303612/'
PAIRS=[('09ed4496','d5cdc503','explosion'),
       ('1a6b3b89','452beb3a','jet'),
       ('0808df1d','1701f4dd','corridor'),
       ('74a54a6c','b7f95910','ufo'),
       ('8040551b','d6f9fac8','parachute')]
import glob
def load(k):
    f=[p for p in glob.glob(D+'*.jpg') if os.path.basename(p).startswith(k)][0]
    return np.array(ImageOps.exif_transpose(Image.open(f)).convert('RGB'))

sift=cv2.SIFT_create(nfeatures=8000)
bf=cv2.BFMatcher()

for ka,kb,name in PAIRS:
    A=load(ka); B=load(kb)
    ga=cv2.cvtColor(A,cv2.COLOR_RGB2GRAY); gb=cv2.cvtColor(B,cv2.COLOR_RGB2GRAY)
    kpa,da=sift.detectAndCompute(ga,None); kpb,db=sift.detectAndCompute(gb,None)
    m=bf.knnMatch(da,db,k=2); good=[x for x,y in m if x.distance<0.72*y.distance]
    src=np.float32([kpa[x.queryIdx].pt for x in good]).reshape(-1,1,2)
    dst=np.float32([kpb[x.trainIdx].pt for x in good]).reshape(-1,1,2)
    M,inl=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=2.0)
    print(name,'inliers',int(inl.sum()),'/',len(good), np.round(M,4).tolist())

    h,w=A.shape[:2]
    # corners of A in B frame
    corners=np.float32([[0,0],[w,0],[w,h],[0,h]]).reshape(-1,1,2)
    tc=cv2.transform(corners,M).reshape(-1,2)
    xs=np.concatenate([tc[:,0],[0,w]]); ys=np.concatenate([tc[:,1],[0,h]])
    x0,x1=int(np.floor(xs.min())),int(np.ceil(xs.max()))
    y0,y1=int(np.floor(ys.min())),int(np.ceil(ys.max()))
    W,H=x1-x0,y1-y0
    off=np.float32([[1,0,-x0],[0,1,-y0]])
    Mo=M.copy(); Mo[0,2]-=x0; Mo[1,2]-=y0
    Aw=cv2.warpAffine(A,Mo,(W,H),flags=cv2.INTER_LANCZOS4,borderValue=(255,255,255))
    Am=cv2.warpAffine(np.full((h,w),255,np.uint8),Mo,(W,H),flags=cv2.INTER_NEAREST,borderValue=0)
    Bw=cv2.warpAffine(B,off,(W,H),flags=cv2.INTER_LANCZOS4,borderValue=(255,255,255))
    Bm=cv2.warpAffine(np.full((h,w),255,np.uint8),off,(W,H),flags=cv2.INTER_NEAREST,borderValue=0)

    # erode masks a bit to drop scanner edge artifacts
    k=np.ones((9,9),np.uint8)
    Am=cv2.erode(Am,k,iterations=3); Bm=cv2.erode(Bm,k,iterations=3)

    # seam: vertical line at centre of horizontal overlap
    colA=Am.mean(0)>10; colB=Bm.mean(0)>10
    ov=np.where(colA&colB)[0]
    seam=int((ov.min()+ov.max())/2)
    aLeft = tc[:,0].mean() < w/2  # is A the left sheet?
    out=np.full((H,W,3),255,np.uint8)
    left,lm,right,rm = (Aw,Am,Bw,Bm) if aLeft else (Bw,Bm,Aw,Am)
    out[:, :seam] = np.where(lm[:, :seam,None]>0, left[:, :seam], 255)
    out[:, seam:] = np.where(rm[:, seam:,None]>0, right[:, seam:], 255)
    # fill any remaining holes from the other image
    hole = np.zeros((H,W),bool)
    hole[:, :seam] = lm[:, :seam]==0
    hole[:, seam:] = rm[:, seam:]==0
    other = np.where(np.stack([np.concatenate([rm[:, :seam],lm[:, seam:]],1)]*3,-1)>0,
                     np.concatenate([right[:, :seam],left[:, seam:]],1),255)
    out[hole]=other[hole]

    # crop to non-white content bbox with margin
    g=cv2.cvtColor(out,cv2.COLOR_RGB2GRAY)
    nz=np.where((g<235).any(1))[0]; nzc=np.where((g<235).any(0))[0]
    valid=(Am>0)|(Bm>0)
    r=np.where(valid.any(1))[0]; c=np.where(valid.any(0))[0]
    out=out[r.min():r.max()+1, c.min():c.max()+1]
    Image.fromarray(out).save(f'/home/claude/work/out/{name}.jpg',quality=94)
    print(' ->',name,out.shape)
