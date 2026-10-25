import {calculateQuote,derivePaymentStatus,stockAvailability,vnd,escapeHtml as esc} from "./logic.js";
import {products,orders,customers} from "./fixtures.js";
const tabs=[["dashboard","Tổng quan","▦"],["sales","Bán hàng","▣"],["orders","Đơn hàng","▤"],["customers","Khách hàng","♙"],["inventory","Kho hàng","▥"],["debt","Công nợ","◷"],["reports","Báo cáo","◫"],["settings","Cài đặt","⚙"]];
const state={tab:"dashboard",cart:[],customer:"",shippingMode:"PENDING",shippingFeeVnd:0,printFeeVnd:0,discountVnd:0,searchProduct:"",searchOrders:"",orderFilter:"ALL",searchCustomers:"",searchStock:""};
const el=id=>document.getElementById(id);
const row=(name,value)=>'<div class="sum-row"><span>'+esc(name)+'</span><b>'+esc(value)+'</b></div>';
const btn=(tab,label,style="button")=>'<button class="'+style+'" data-nav="'+tab+'">'+esc(label)+'</button>';
const title=(name,desc,action="")=>'<div class="screen-heading"><div><h1>'+name+'</h1><p>'+desc+'</p></div><div class="action-row">'+action+'</div></div>';
const cardHead=(name,tag="")=>'<div class="card-head"><h2>'+name+'</h2>'+tag+'</div>';
const notice='<div class="notice">Bản mẫu dùng dữ liệu giả lập. Lưu đơn, thu tiền, xuất kho và ghi dữ liệu thực tế chưa được kích hoạt.</div>';
const stat=(title,value,foot,icon="◈")=>'<article class="card kpi"><div class="kpi-icon">'+icon+'</div><div class="kpi-label">'+esc(title)+'</div><div class="kpi-value">'+esc(value)+'</div><div class="kpi-foot">'+esc(foot)+'</div></article>';
const inp=(id,val,label)=>'<div class="field"><label for="'+id+'">'+esc(label)+'</label><input class="input" id="'+id+'" type="number" min="0" step="1" inputmode="numeric" data-field="'+id+'" value="'+val+'"></div>';
const phaseStyle=p=>p==="Nháp"?"amber":p==="Chờ giao"?"green":p==="Chờ duyệt mẫu"?"amber":"";
function nav(){
 el("side-nav").innerHTML=tabs.map(x=>'<button class="nav-item '+(x[0]===state.tab?"active":"")+'" data-nav="'+x[0]+'" '+(x[0]===state.tab?'aria-current="page"':"")+'><span class="ni">'+x[2]+'</span>'+x[1]+'</button>').join("");
 el("bottom-nav").innerHTML=tabs.slice(0,4).concat([["more","Thêm","☰"]]).map(x=>'<button class="bottom-item '+(x[0]===state.tab?"active":"")+'" data-nav="'+x[0]+'"><span>'+x[2]+'</span>'+x[1]+'</button>').join("");
}
function orderRows(list){
 return list.map(o=>'<tr><td><strong>'+esc(o.id)+'</strong><div class="thin">'+esc(o.date)+'</div></td><td><strong>'+esc(o.customer)+'</strong><div class="thin">'+esc(o.brand)+'</div></td><td><span class="status '+phaseStyle(o.phase)+'">'+esc(o.phase)+'</span></td><td>'+vnd(o.total)+'</td><td>'+(o.total===null?"Chờ chốt":vnd(o.total-o.received))+'</td><td><button class="button mini" data-order="'+esc(o.id)+'">Xem</button></td></tr>').join("");
}
const orderHeaders='<thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Trạng thái</th><th>Giá trị</th><th>Còn thu</th><th></th></tr></thead>';
function dashboard(){
 const pending=orders.filter(x=>x.phase!=="Nháp").length;
 const uncounted=products.filter(p=>stockAvailability(p).state==="UNKNOWN").length;
 const owed=orders.filter(o=>o.total!==null&&o.total>o.received).length;
 const paid=orders.reduce((sum,o)=>sum+o.received,0);
 return title("Tổng quan hoạt động","Tổng hợp theo dõi đơn hàng, sản xuất, giao nhận và công nợ",btn("sales","＋ Tạo đơn mới","button primary"))+
 '<div class="notice info">Giao diện mẫu, toàn bộ số liệu bên dưới không phải dữ liệu kinh doanh thực.</div>'+
 '<div class="kpi-grid">'+stat("Đơn đang xử lý",pending,"Dữ liệu mẫu","▤")+stat("Chờ duyệt mẫu",orders.filter(o=>o.phase==="Chờ duyệt mẫu").length,"Đơn in logo","✎")+
 stat("Chờ giao",orders.filter(o=>o.phase==="Chờ giao").length,"Lịch giao mẫu","↗")+stat("Chưa thu đủ",owed,"Không tính đơn chưa chốt","◷")+
 stat("SKU chưa kiểm kê",uncounted,"Không đồng nghĩa tồn 0","▥")+stat("Đã thu (dữ liệu mẫu)",vnd(paid),"Phiếu thu mô phỏng","₫")+'</div>'+
 '<div class="cols-2"><section class="card">'+cardHead("Đơn cần xử lý",'<span class="tag">DEMO</span>')+'<div class="table-scroll"><table class="surface-table">'+orderHeaders+'<tbody>'+orderRows(orders)+'</tbody></table></div></section>'+
 '<section class="card">'+cardHead("Thao tác nhanh")+'<div class="card-body">'+[["sales","▣","Lập đơn mới"],["orders","▤","Đơn và sản xuất"],["inventory","▥","Tra cứu kho"],["debt","◷","Công nợ"]].map(x=>'<button class="quick-link" data-nav="'+x[0]+'"><span>'+x[1]+'</span>'+x[2]+'<b>›</b></button>').join("")+'<p class="help-text">Chức năng ghi chỉ mở khi backend V7 đạt nghiệm thu.</p></div></section></div>';
}
function matchingProduct(){
 const q=state.searchProduct.toLocaleLowerCase("vi-VN").trim();
 return products.filter(p=>(p.name+" "+p.sku).toLocaleLowerCase("vi-VN").includes(q));
}
function catalog(){
 return matchingProduct().map(p=>{
  const stock=stockAvailability(p);
  const label=stock.state==="UNKNOWN"?"Chưa kiểm kê":stock.state==="RECONCILE"?"Cần đối soát":stock.state==="OUT"?"Hết hàng":"Khả dụng: "+stock.available+" "+p.unit;
  return '<button class="product" data-add="'+esc(p.sku)+'"><span class="product-graphic">▱</span><span class="product-info"><strong>'+esc(p.name)+'</strong><small>'+esc(p.sku)+' · '+esc(p.pack)+'</small><small>'+esc(label)+'</small></span><span class="product-price">'+vnd(p.priceVnd)+'<div class="hint">+ Thêm</div></span></button>';
 }).join("")||'<div class="empty">Không có sản phẩm mẫu phù hợp.</div>';
}
function quote(){
 try{return calculateQuote(state.cart,{shippingMode:state.shippingMode,shippingFeeVnd:state.shippingFeeVnd,printFeeVnd:state.printFeeVnd,discountVnd:state.discountVnd})}
 catch{return null}
}
function cartLine(c){
 const p=products.find(x=>x.sku===c.sku);
 return '<div class="cart-line"><div class="cart-line-top"><div><strong>'+esc(p?.name||c.sku)+'</strong><small>'+esc(c.sku)+' · '+esc(p?.pack||"")+'</small></div><button class="remove" data-remove="'+esc(c.sku)+'" aria-label="Xóa khỏi giỏ">×</button></div>'+
 '<div class="inline-fields"><div class="field"><label>Số thùng/bao</label><input class="input" type="number" min="1" step="1" data-qty="'+esc(c.sku)+'" value="'+c.quantity+'"></div>'+
 '<div class="field"><label>Giá chốt / ĐVT (VNĐ)</label><input class="input" type="number" min="0" step="1" data-price="'+esc(c.sku)+'" value="'+c.unitPriceVnd+'"></div></div>'+
 row("Thành tiền",vnd(c.quantity*c.unitPriceVnd))+'</div>';
}
function sales(){
 const q=quote();
 const shipping=[["PENDING","Chưa chốt cước"],["INCLUDED","Giá đã bao gồm cước"],["FREE","Miễn phí giao khách"],["SEPARATE","Thu cước riêng"]];
 return title("Bán hàng","Giỏ hàng theo SKU, giá thương lượng và 4 phương án cước",'<span class="tag">Nháp mẫu · Chưa lưu</span>')+
 notice+'<div class="pos-grid"><section class="card">'+cardHead("1. Chọn sản phẩm")+'<div class="card-body"><div class="field"><label for="search-product">Tìm SKU hoặc tên sản phẩm</label><input class="input" id="search-product" placeholder="VD: PP 700ml" value="'+esc(state.searchProduct)+'"></div><div class="product-list" id="product-list">'+catalog()+'</div></div></section>'+
 '<section class="card">'+cardHead("2. Giỏ hàng",'<span class="tag">'+state.cart.length+' dòng</span>')+'<div class="card-body"><div class="cart-list">'+(state.cart.map(cartLine).join("")||'<div class="empty"><i>▣</i>Chọn sản phẩm để lập báo giá.</div>')+'</div></div></section>'+
 '<section class="card pos-summary">'+cardHead("3. Khách & thanh toán")+'<div class="card-body"><div class="field"><label for="customer-name">Khách hàng (mẫu)</label><input class="input" id="customer-name" placeholder="Tên khách mô phỏng" value="'+esc(state.customer)+'"></div>'+
 '<div class="field"><label for="shipping-mode">Phương án vận chuyển</label><select class="select" id="shipping-mode">'+shipping.map(x=>'<option value="'+x[0]+'" '+(state.shippingMode===x[0]?"selected":"")+'>'+x[1]+'</option>').join("")+'</select></div>'+
 (state.shippingMode==="SEPARATE"?inp("shippingFeeVnd",state.shippingFeeVnd,"Cước thu khách (VNĐ)"):"")+
 inp("printFeeVnd",state.printFeeVnd,"Phí in / thiết kế (VNĐ)")+inp("discountVnd",state.discountVnd,"Giảm giá thỏa thuận (VNĐ)")+
 row("Tiền hàng",q?vnd(q.subtotalVnd):"Lỗi dữ liệu")+row("Phí in / thiết kế",vnd(state.printFeeVnd))+
 row("Cước thu khách",state.shippingMode==="PENDING"?"Chưa chốt":vnd(q?.shippingVnd??null))+row("Giảm giá","− "+vnd(state.discountVnd))+
 '<div class="sum-row final"><span>'+(q?.quoteReady?"Tổng đã chốt":"Tạm tính (chưa chốt cước)")+'</span><b>'+(q?vnd(q.quoteReady?q.officialTotalVnd:q.provisionalVnd):"Không hợp lệ")+'</b></div>'+
 '<div class="action-row"><button class="button" data-quote>Xem tóm tắt</button><button class="button primary" disabled>Lưu đơn</button><button class="button" disabled>Chốt đơn</button></div>'+
 '<p class="help-text">Lưu nháp không tự giữ/trừ kho. Giá thương lượng không đổi bảng giá danh mục.</p></div></section></div>';
}
function ordersPage(){
 const list=orders.filter(o=>(state.orderFilter==="ALL"||state.orderFilter===o.phase)&&
 (o.id+" "+o.customer+" "+o.brand).toLocaleLowerCase("vi-VN").includes(state.searchOrders.toLocaleLowerCase("vi-VN").trim()));
 const filters=["Nháp","Chờ duyệt mẫu","Đang in","Chờ giao"];
 return title("Đơn hàng & sản xuất","Trạng thái sản xuất, giao hàng và thanh toán được quản lý độc lập")+
 '<div class="filter-bar"><input class="input" id="search-orders" placeholder="Mã đơn, khách hoặc thương hiệu" value="'+esc(state.searchOrders)+'">'+
 '<select class="select" id="order-filter"><option value="ALL">Tất cả trạng thái</option>'+filters.map(p=>'<option '+(state.orderFilter===p?"selected":"")+'>'+p+'</option>').join("")+'</select></div>'+
 '<section class="card"><div class="table-scroll"><table class="surface-table">'+orderHeaders+'<tbody>'+(orderRows(list)||'<tr><td colspan="6">Không có đơn phù hợp.</td></tr>')+'</tbody></table></div></section>';
}
function customersPage(){
 const q=state.searchCustomers.toLocaleLowerCase("vi-VN").trim();
 const data=customers.filter(x=>(x.name+" "+x.brand+" "+x.id).toLocaleLowerCase("vi-VN").includes(q));
 return title("Khách hàng & thương hiệu","Tách khách liên hệ, thương hiệu, địa chỉ và công nợ",'<button class="button primary" disabled>＋ Thêm khách</button>')+
 '<div class="filter-bar"><input class="input" id="search-customers" placeholder="Tìm khách hoặc thương hiệu" value="'+esc(state.searchCustomers)+'"></div>'+
 '<section class="card"><div class="table-scroll"><table class="surface-table"><thead><tr><th>Mã khách</th><th>Khách hàng</th><th>Thương hiệu</th><th>Liên hệ</th><th>Công nợ</th></tr></thead><tbody>'+
 (data.map(x=>'<tr><td>'+esc(x.id)+'</td><td><strong>'+esc(x.name)+'</strong></td><td>'+esc(x.brand)+'</td><td>'+esc(x.phone)+'</td><td>'+vnd(x.debt)+'</td></tr>').join("")||'<tr><td colspan="5">Không tìm thấy.</td></tr>')+'</tbody></table></div></section>';
}
function inventoryPage(){
 const uncounted=products.filter(x=>stockAvailability(x).state==="UNKNOWN").length;
 const q=state.searchStock.toLocaleLowerCase("vi-VN").trim();
 const matches=products.filter(x=>(x.name+" "+x.sku).toLocaleLowerCase("vi-VN").includes(q));
 return title("Kho & kiểm kê","Tồn chưa xác nhận là UNKNOWN, tuyệt đối không hiển thị thành 0",'<button class="button" disabled>Nhập kho</button><button class="button" disabled>Xuất kho</button>')+
 '<div class="inventory-grid">'+stat("SKU đã kiểm kê còn hàng",products.filter(x=>stockAvailability(x).state==="KNOWN").length,"Trong danh mục mô phỏng")+
 stat("SKU chưa kiểm kê",uncounted,"Không tự cho phép xuất")+stat("SKU hết hàng đã xác nhận",products.filter(x=>stockAvailability(x).state==="OUT").length,"Không phải chưa kiểm kê")+'</div>'+
 '<div class="filter-bar"><input id="search-stock" class="input" placeholder="Tìm SKU hoặc tên" value="'+esc(state.searchStock)+'"></div>'+
 '<section class="card"><div class="table-scroll"><table class="surface-table"><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Quy cách</th><th>Trên sổ</th><th>Đang giữ</th><th>Khả dụng</th><th>Trạng thái</th></tr></thead><tbody>'+
 (matches.map(p=>{const st=stockAvailability(p),unknown=st.available===null;return '<tr><td><strong>'+esc(p.sku)+'</strong></td><td>'+esc(p.name)+'</td><td>'+esc(p.pack)+'</td><td>'+(unknown?"—":p.onHand)+'</td><td>'+(unknown?"—":p.held)+'</td><td>'+(unknown?"—":st.available)+'</td><td><span class="status '+(st.state==="KNOWN"?"green":st.state==="OUT"?"red":"amber")+'">'+(st.state==="UNKNOWN"?"Chưa kiểm kê":st.state==="OUT"?"Hết hàng":st.state==="RECONCILE"?"Cần đối soát":"Đã kiểm kê")+'</span></td></tr>'}).join("")||'<tr><td colspan="7">Không có SKU.</td></tr>')+'</tbody></table></div></section>';
}
function debtPage(){
 const due=orders.filter(o=>o.total!==null).reduce((sum,o)=>sum+o.total-o.received,0);
 return title("Thanh toán & công nợ","Phân biệt công nợ đơn chốt với tổng nháp chưa xác định")+
 '<div class="kpi-grid">'+stat("Công nợ mẫu",vnd(due),"Chỉ đơn đã chốt")+
 stat("Đơn chưa thu đủ",orders.filter(o=>o.total!==null&&o.received<o.total).length,"Bản ghi mô phỏng")+
 stat("Đơn chưa chốt tổng",orders.filter(o=>o.total===null).length,"Không tính nợ")+'</div>'+
 '<section class="card">'+cardHead("Công nợ theo đơn")+'<div class="table-scroll"><table class="surface-table"><thead><tr><th>Đơn</th><th>Khách</th><th>Đã chốt</th><th>Thực thu</th><th>Còn thu</th></tr></thead><tbody>'+
 orders.map(o=>{const p=derivePaymentStatus(o.total,o.received?[{state:"CONFIRMED",amountVnd:o.received}]:[]);return '<tr><td>'+esc(o.id)+'</td><td>'+esc(o.customer)+'</td><td>'+vnd(o.total)+'</td><td>'+vnd(p.netReceivedVnd)+'</td><td>'+vnd(p.balanceVnd)+'</td></tr>'}).join("")+'</tbody></table></div></section>';
}
function reportPage(){
 const total=orders.filter(o=>o.total!==null).reduce((s,o)=>s+o.total,0);
 const paid=orders.reduce((s,o)=>s+o.received,0);
 return title("Báo cáo","Theo dõi đơn, số tiền đã chốt, thực thu và công nợ trên dữ liệu mô phỏng")+
 '<div class="notice info">Báo cáo này không nối sổ kế toán hoặc kho thực.</div><div class="report-grid"><article class="card placeholder-panel"><h2>Đơn theo trạng thái</h2><div class="bar-list">'+
 ["Chờ duyệt mẫu","Đang in","Chờ giao","Nháp"].map(s=>{const n=orders.filter(o=>o.phase===s).length;return '<div><div class="bar-line"><span>'+s+'</span><b>'+n+'</b></div><div class="track"><div style="width:'+(100*n/orders.length)+'%"></div></div></div>'}).join("")+'</div></article>'+
 '<article class="card placeholder-panel"><h2>Đối soát tiền</h2>'+row("Đơn đã chốt",vnd(total))+row("Thực thu xác nhận (demo)",vnd(paid))+row("Còn thu",vnd(total-paid))+'<p class="help-text">Chưa tích hợp chứng từ thực tế.</p></article></div>';
}
function settingsPage(){
 return title("Cài đặt & phân quyền","RBAC tương lai phải được xác thực ở server, không tin quyền trong giao diện")+
 notice+'<div class="cols-2"><section class="card">'+cardHead("Môi trường")+'<div class="card-body">'+row("Nguồn dữ liệu","Fixtures mô phỏng")+
 row("Apps Script","Chưa kết nối")+row("Quyền ghi","Đã khóa")+row("Giai đoạn","T017–T020 preview")+'</div></section>'+
 '<section class="card">'+cardHead("Vai trò dự kiến")+'<div class="card-body">'+["Owner: toàn quyền","Sales: quản lý đơn","Warehouse: tồn và chứng từ","Accounting: công nợ và phiếu thu","Viewer: chỉ xem"].map(x=>'<p class="details">'+esc(x)+'</p>').join("")+'</div></section></div>';
}
const views={dashboard,sales,orders:ordersPage,customers:customersPage,inventory:inventoryPage,debt:debtPage,reports:reportPage,settings:settingsPage};
function render(){
 nav();el("crumb").textContent=tabs.find(x=>x[0]===state.tab)[1];
 el("screen").innerHTML=views[state.tab]();
}
function closeMenu(){el("sidebar").classList.remove("open");el("overlay").hidden=true}
function toast(message){el("toast").textContent=message;el("toast").hidden=false}
function dialog(title,details){
 const node=document.createElement("div");node.id="demo-dialog";node.className="modal-backdrop";
 node.innerHTML='<section class="dialog" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><h2>'+esc(title)+'</h2>'+details+
 '<div class="action-row"><button class="button primary" data-close-dialog>Đóng</button></div></section>';
 document.body.append(node);node.querySelector("button").focus();
}
document.addEventListener("click",event=>{
 const a=event.target.closest("[data-nav],[data-add],[data-remove],[data-order],[data-quote],[data-close-dialog]");
 if(a?.hasAttribute("data-nav")){
  const target=a.dataset.nav;
  if(target==="more"){el("sidebar").classList.add("open");el("overlay").hidden=false;return}
  if(!views[target])return;
  state.tab=target;closeMenu();render();el("screen").focus();return;
 }
 if(a?.hasAttribute("data-add")){
  const p=products.find(x=>x.sku===a.dataset.add);if(!p)return;
  const item=state.cart.find(x=>x.sku===p.sku);
  if(item)item.quantity++;else state.cart.push({sku:p.sku,quantity:1,unitPriceVnd:p.priceVnd});
  render();return;
 }
 if(a?.hasAttribute("data-remove")){
  state.cart=state.cart.filter(x=>x.sku!==a.dataset.remove);render();return;
 }
 if(a?.hasAttribute("data-order")){
  const o=orders.find(x=>x.id===a.dataset.order);if(!o)return;
  dialog("Đơn "+o.id,'<p class="muted">Chỉ dữ liệu mẫu, không phải đơn thật.</p><div class="details">'+
  '<p><b>Khách:</b> '+esc(o.customer)+' · '+esc(o.brand)+'</p><p><b>Trạng thái:</b> '+esc(o.phase)+'</p><p><b>Giao:</b> '+esc(o.ship)+'</p><p><b>Tổng:</b> '+vnd(o.total)+'</p><p><b>Đã thu:</b> '+vnd(o.received)+'</p></div>');
  return;
 }
 if(a?.hasAttribute("data-quote")){
  const q=quote();
  dialog("Tóm tắt báo giá mẫu",q?'<div class="details">'+row("Khách",state.customer||"Chưa chọn")+row("Số dòng",state.cart.length)+row("Tiền hàng",vnd(q.subtotalVnd))+
  row("Cước",q.shippingMode==="PENDING"?"Chưa chốt":vnd(q.shippingVnd))+row(q.quoteReady?"Tổng chốt":"Tạm tính",vnd(q.quoteReady?q.officialTotalVnd:q.provisionalVnd))+'</div>':'<p>Giá, số lượng hoặc giảm giá không hợp lệ.</p>');
  return;
 }
 if(a?.hasAttribute("data-close-dialog")){el("demo-dialog")?.remove();return}
 if(event.target.id==="demo-dialog")el("demo-dialog").remove();
 if(event.target.id==="overlay")closeMenu();
 if(event.target.id==="menu-toggle"){el("sidebar").classList.add("open");el("overlay").hidden=false}
});
document.addEventListener("input",event=>{
 const box=event.target;
 const map={"search-product":"searchProduct","search-orders":"searchOrders","search-customers":"searchCustomers","search-stock":"searchStock"};
 if(map[box.id]){
  state[map[box.id]]=box.value;
  if(box.id==="search-product")el("product-list").innerHTML=catalog();
  else {const pos=box.selectionStart;render();const field=el(box.id);field.focus();field.setSelectionRange(pos,pos)}
 }
});
document.addEventListener("change",event=>{
 const node=event.target;
 if(node.hasAttribute("data-qty")||node.hasAttribute("data-price")){
  const item=state.cart.find(x=>x.sku===(node.dataset.qty||node.dataset.price));if(!item)return;
  const n=Number(node.value);
  if(!Number.isSafeInteger(n)||(node.hasAttribute("data-qty")?n<=0:n<0)){toast("Số lượng phải nguyên dương; giá phải nguyên không âm.");render();return}
  if(node.hasAttribute("data-qty"))item.quantity=n;else item.unitPriceVnd=n;
  render();return;
 }
 if(node.id==="shipping-mode"){state.shippingMode=node.value;render();return}
 if(node.id==="customer-name"){state.customer=node.value;return}
 if(node.hasAttribute("data-field")){
  const v=Number(node.value);
  if(!Number.isSafeInteger(v)||v<0){toast("Số tiền VNĐ không hợp lệ.");render();return}
  state[node.dataset.field]=v;render();return;
 }
 if(node.id==="order-filter"){state.orderFilter=node.value;render()}
});
document.addEventListener("keydown",event=>{if(event.key==="Escape"){el("demo-dialog")?.remove();closeMenu()}});
render();
