// Publicly shareable SYNTHETIC examples only; no customer or order production data.
export const products=[
 {sku:"DEMO-PP700-01",name:"Ly PP 700ml trong",pack:"1.000 cái/thùng",unit:"thùng",priceVnd:450000,openingConfirmed:true,onHand:12,held:2},
 {sku:"DEMO-PP520-02",name:"Ly PP 520ml",pack:"1.000 cái/thùng",unit:"thùng",priceVnd:390000,openingConfirmed:false,onHand:null,held:null},
 {sku:"DEMO-PET500-03",name:"Ly PET 500ml nắp cầu",pack:"500 cái/thùng",unit:"thùng",priceVnd:320000,openingConfirmed:true,onHand:3,held:0},
 {sku:"DEMO-LID90-04",name:"Nắp phẳng Ø90",pack:"2.000 cái/thùng",unit:"thùng",priceVnd:220000,openingConfirmed:false,onHand:null,held:null},
 {sku:"DEMO-PAPER-05",name:"Ly giấy 360ml",pack:"1.000 cái/thùng",unit:"thùng",priceVnd:580000,openingConfirmed:true,onHand:0,held:0}
];
export const orders=[
 {id:"DEMO-2401",customer:"Khách mẫu A",brand:"Thương hiệu A",phase:"Chờ duyệt mẫu",payment:"PARTIAL",total:1380000,received:500000,ship:"Giao xe máy",date:"25/10/2026"},
 {id:"DEMO-2402",customer:"Khách mẫu B",brand:"Ly trơn",phase:"Chờ giao",payment:"PAID",total:780000,received:780000,ship:"Nhận tại xưởng",date:"25/10/2026"},
 {id:"DEMO-2403",customer:"Khách mẫu C",brand:"Thương hiệu C",phase:"Nháp",payment:"TOTAL_PENDING",total:null,received:0,ship:"Chưa chốt",date:"24/10/2026"},
 {id:"DEMO-2404",customer:"Khách mẫu D",brand:"Thương hiệu D",phase:"Đang in",payment:"UNPAID",total:2200000,received:0,ship:"Giao cố định",date:"24/10/2026"}
];
export const customers=[
 {id:"DEMO-C01",name:"Khách mẫu A",brand:"Thương hiệu A",phone:"SĐT mẫu (ẩn)",debt:880000},
 {id:"DEMO-C02",name:"Khách mẫu B",brand:"Ly trơn",phone:"SĐT mẫu (ẩn)",debt:0},
 {id:"DEMO-C03",name:"Khách mẫu C",brand:"Thương hiệu C",phone:"SĐT mẫu (ẩn)",debt:null},
 {id:"DEMO-C04",name:"Khách mẫu D",brand:"Thương hiệu D",phone:"SĐT mẫu (ẩn)",debt:2200000}
];
