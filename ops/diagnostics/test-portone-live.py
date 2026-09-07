import json, urllib.request, urllib.error, http.cookiejar
base='https://production.172.16.1.232.nip.io'
jar=http.cookiejar.CookieJar()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def post(action, body, origin=base):
    req=urllib.request.Request(base+'/api/identity/portone-test/'+action,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Origin':origin})
    try:
        with client.open(req,timeout=20) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
code,value=post('start',{'consent':True},'https://untrusted.invalid')
assert code==403
print('PASS foreign origin rejected')
code,value=post('start',{'consent':False})
assert code==400 and value['code']=='CONSENT_REQUIRED'
print('PASS explicit consent required')
code,value=post('start',{'consent':True})
assert code==200 and value['mode']=='test' and value['loginEnabled'] is False
assert 'apiSecret' not in value and 'ci' not in value
print('PASS credential loaded and test attempt created without secrets')
code,failed=post('complete',{'identityVerificationId':value['identityVerificationId'],'csrf':'invalid'})
assert code==400
print('PASS invalid csrf rejected')
code,failed=post('complete',{'identityVerificationId':value['identityVerificationId'],'csrf':value['csrf']})
assert code==400 and failed['code']=='VERIFICATION_FAILED'
print('PASS unverified real provider record rejected')
code,failed=post('complete',{'identityVerificationId':value['identityVerificationId'],'csrf':value['csrf']})
assert code==400 and failed['code']=='INVALID_OR_EXPIRED_ATTEMPT'
print('PASS consumed attempt cannot replay')
