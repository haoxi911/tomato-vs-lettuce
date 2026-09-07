import cv2, numpy as np, glob, os, itertools
from PIL import Image, ImageOps

files=sorted(glob.glob('/root/.claude/uploads/27a4b9c7-7fb7-5cb4-a3c5-b75e7e303612/*.jpg'))
imgs={}
for f in files:
    im=ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    imgs[os.path.basename(f)[:8]]=np.array(im)

keys=list(imgs)
sift=cv2.SIFT_create(nfeatures=4000)
feat={}
for k in keys:
    g=cv2.cvtColor(imgs[k],cv2.COLOR_RGB2GRAY)
    g=cv2.resize(g,None,fx=0.4,fy=0.4)
    kp,des=sift.detectAndCompute(g,None)
    feat[k]=(kp,des)
    print(k,len(kp))

bf=cv2.BFMatcher()
res=[]
for a,b in itertools.combinations(keys,2):
    ka,da=feat[a]; kb,db=feat[b]
    m=bf.knnMatch(da,db,k=2)
    good=[x for x,y in m if x.distance<0.7*y.distance]
    if len(good)>=8:
        src=np.float32([ka[x.queryIdx].pt for x in good]).reshape(-1,1,2)
        dst=np.float32([kb[x.trainIdx].pt for x in good]).reshape(-1,1,2)
        M,inl=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=3)
        ninl=int(inl.sum()) if inl is not None else 0
    else:
        ninl=0; M=None
    res.append((ninl,a,b,M))
res.sort(reverse=True,key=lambda r:r[0])
for r in res[:20]:
    print(r[0],r[1],r[2], np.round(r[3],3).tolist() if r[3] is not None else None)
