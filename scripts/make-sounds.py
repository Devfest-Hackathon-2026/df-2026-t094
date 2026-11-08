# 8bit 風の効果音とゲーム中BGMを数式で作る
import numpy as np, wave
SR=44100
def f(n): return 440*2**((n-69)/12)  # MIDI番号→Hz
def env(N,a=0.005,r=0.08):
    e=np.ones(N); A=int(a*SR); R=int(r*SR)
    if A: e[:A]=np.linspace(0,1,A)
    if R and R<N: e[-R:]*=np.linspace(1,0,R)
    return e
def square(fr,dur,duty=0.25,vol=0.3,a=0.005,r=0.08,slide=None):
    N=int(dur*SR); t=np.arange(N)/SR
    fr_t=np.full(N,fr) if slide is None else np.linspace(fr,slide,N)
    ph=np.cumsum(fr_t)/SR
    w=np.where((ph%1)<duty,1.0,-1.0)
    return w*vol*env(N,a,r)
def tri(fr,dur,vol=0.3,a=0.005,r=0.05,slide=None):
    N=int(dur*SR)
    fr_t=np.full(N,fr) if slide is None else np.linspace(fr,slide,N)
    ph=np.cumsum(fr_t)/SR
    w=2*np.abs(2*(ph%1)-1)-1
    return w*vol*env(N,a,r)
def place(buf,sig,t):
    i=int(t*SR); buf[i:i+len(sig)]+=sig[:max(0,len(buf)-i)]
def save(name,x):
    x=x/max(1e-9,np.max(np.abs(x)))*0.8
    # 角を丸めるかんたんなローパス
    k=np.ones(4)/4; x=np.convolve(x,k,mode='same')
    d=(np.clip(x,-1,1)*32767).astype(np.int16)
    with wave.open(name,'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())

# 成功: ド・ミ・ソ・ド↑ と上がって、最後に和音をのばす
x=np.zeros(int(1.6*SR))
for i,n in enumerate([72,76,79,84]):
    place(x,square(f(n),0.12,0.5,0.35),i*0.09)
for n in [72,76,79,84]:
    place(x,square(f(n),0.9,0.25,0.18,r=0.5),0.4)
place(x,tri(f(48),0.9,0.35,r=0.5),0.4)
save('success.wav',x)

# 失敗: 「ぷわわ〜ん」と下がる2音（かわいく、こわくない）
x=np.zeros(int(1.3*SR))
place(x,square(f(67),0.18,0.5,0.3),0)
place(x,square(f(66),0.18,0.5,0.3),0.2)
place(x,square(f(65),0.7,0.5,0.3,r=0.3,slide=f(60)),0.4)
place(x,tri(f(41),0.9,0.3,r=0.4,slide=f(36)),0.4)
save('fail.wav',x)

# ゲーム中BGM: 100BPM、8小節をくり返す。C-Am-F-G を2回。ベース（三角波）＋メロディ（細い矩形波）＋小さな和音の刻み
bpm=100; q=60/bpm; bars=8
x=np.zeros(int(bars*4*q*SR)+SR)
chords=[(48,[60,64,67]),(45,[57,60,64]),(41,[57,60,65]),(43,[55,59,62])]*2
for b,(root,ch) in enumerate(chords):
    t0=b*4*q
    for k in range(4):  # ベース: 1拍ずつ、ルートと5度
        n=root if k%2==0 else root+7
        place(x,tri(f(n),q*0.9,0.32,r=0.05),t0+k*q)
    for k in range(8):  # 和音の刻み（裏拍だけ、小さく）
        if k%2==1:
            for n in ch: place(x,square(f(n),q*0.25,0.125,0.035,r=0.04),t0+k*q/2)
# メロディ（ド・レ・ミ・ソ・ラ の5音だけで、のんびり）
mel=[ (72,1),(74,.5),(76,.5),(79,1),(76,1),
      (76,1),(74,.5),(72,.5),(69,2),
      (69,1),(72,.5),(74,.5),(76,1),(74,1),
      (74,1.5),(72,.5),(74,2),
      (72,1),(74,.5),(76,.5),(79,1),(81,1),
      (79,1),(76,.5),(74,.5),(72,2),
      (69,1),(72,1),(74,1),(76,.5),(74,.5),
      (72,3),(None,1)]
t=0
for n,l in mel:
    if n: place(x,square(f(n),l*q*0.92,0.25,0.12,r=0.06),t)
    t+=l*q
x=x[:int(bars*4*q*SR)]
save('game.wav',x)
print('ok', bars*4*q)
