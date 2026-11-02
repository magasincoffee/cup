// Private Owner QA application boundary; never import this into public GitHub Pages.
// The caller must be authenticated by the host/server before supplying readSnapshot.
// This module neither authenticates users nor contacts Google itself.
import {loadReadOnlySnapshot,ReadContractError} from '../../v7-preview/read-contract.js';
export async function loadPrivateOwnerQaView(readSnapshot,options={}){
 const data=await loadReadOnlySnapshot(readSnapshot,{allowPrivateQa:true,...options});
 if(data.source!=='OWNER_QA')throw new ReadContractError('PRIVATE_QA_SOURCE_REQUIRED');
 return Object.freeze({readOnly:true,revision:data.revision,issuedAt:data.issuedAt,
  products:data.products,orders:data.orders,customers:data.customers});
}
