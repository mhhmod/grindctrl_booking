// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({authorize:vi.fn(),token:vi.fn(),limit:vi.fn()}));
vi.mock('@/lib/shopify/shops',()=>({requireManagedTryOnShop:m.authorize}));
vi.mock('@/lib/shopify/tokens',()=>({getShopToken:m.token}));
vi.mock('@/lib/request-rate-limit',()=>({merchantRateLimitResponse:m.limit}));
import {GET as theme} from './route';
import {GET as admin} from '../admin-link/route';
beforeEach(()=>{
  vi.resetAllMocks(); m.authorize.mockResolvedValue('demo.myshopify.com');
  m.token.mockResolvedValue({appClientId:'verified-app-b'}); m.limit.mockResolvedValue(null);
});
for(const [name,handler] of [['theme',theme],['admin',admin]] as const){
 describe(`${name} installation links`,()=>{
  const req=()=>new NextRequest(`https://grindctrl.cloud/api/shopify/${name}-link?shop=demo.myshopify.com&block=messenger`);
  it('authorizes the store before resolving any credential',async()=>{
   m.authorize.mockRejectedValue(new Error('other tenant'));
   expect((await handler(req())).status).toBe(403);
   expect(m.token).not.toHaveBeenCalled();
  });
  it('fails closed under unavailable rate enforcement',async()=>{
   m.limit.mockResolvedValue(new Response('unavailable',{status:503}));
   expect((await handler(req())).status).toBe(503); expect(m.token).not.toHaveBeenCalled();
  });
  it('does not guess when credentials/installation identity are unavailable',async()=>{
   m.token.mockResolvedValue(null); expect((await handler(req())).status).toBe(409);
  });
  it('targets only the verified installation on the authorized shop',async()=>{
   const response=await handler(req());
   expect(response.status).toBe(307);
   const target=new URL(response.headers.get('location')!);
   expect(target.hostname).toBe('demo.myshopify.com');
   expect(target.href).toContain('verified-app-b');
   if(name==='theme') expect(m.authorize).toHaveBeenCalledWith('demo.myshopify.com',{capability:'settings'});
  });
 });
}
it('rejects unknown theme blocks without credential reads',async()=>{
 const response=await theme(new NextRequest('https://grindctrl.cloud/api/shopify/theme-link?shop=demo.myshopify.com&block=evil'));
 expect(response.status).toBe(400);expect(m.token).not.toHaveBeenCalled();
});
