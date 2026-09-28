import sys
for s,lim in [(a,int(b)) for a,b in (x.rsplit('|',1) for x in sys.argv[1:])]:
    print(len(s), '/', lim, 'OK' if len(s)<=lim else 'TOO LONG', '|', s)
