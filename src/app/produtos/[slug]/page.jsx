import {notFound} from 'next/navigation';
import {portfolio} from '../../../lib/commercial/portfolio.js';
import {slug} from '../../../lib/commercial/navigation.js';
import ProductExperience from './product-experience';
export function generateStaticParams(){return portfolio.map(p=>({slug:slug(p.name)}));}
export async function generateMetadata({params}){const {slug:key}=await params;const p=portfolio.find(x=>slug(x.name)===key);return {title:p?`PLENIUM ${p.name} | Soluções empresariais`:'PLENIUM'};}
export default async function Page({params}){const {slug:key}=await params;const p=portfolio.find(x=>slug(x.name)===key);if(!p)notFound();return <ProductExperience id={p.id}/>;}
