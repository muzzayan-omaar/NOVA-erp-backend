import prisma from "../lib/prisma.js";



// =======================================
// DASHBOARD ANALYTICS
// =======================================

export const getDashboardAnalytics = async (req,res)=>{

try{


const {
  storeId = "ALL"
}=req.query;



const where = {

  companyId:req.user.companyId

};



// Branch filtering

if(storeId !== "ALL"){

  where.storeId = storeId;

}




const sales = await prisma.sale.findMany({

where,

include:{

saleItems:{

include:{
product:true
}

},

user:true

}

});





// Revenue

const totalRevenue = sales.reduce(

(sum,s)=>

sum + Number(s.totalAmount),

0

);




// Transactions

const totalTransactions =
sales.length;





// Today

const today =
new Date();

today.setHours(
0,0,0,0
);



const todaySales =
sales.filter(
s=>new Date(s.createdAt)>=today
);



const todayRevenue =
todaySales.reduce(

(sum,s)=>
sum + Number(s.totalAmount),

0

);





// Top products

const productMap={};



sales.forEach(sale=>{


sale.saleItems.forEach(item=>{


if(!productMap[item.productId]){

productMap[item.productId]={

name:item.product.name,

qty:0

};

}


productMap[item.productId].qty +=
item.quantity;


});


});





const topProducts =
Object.values(productMap)
.sort(
(a,b)=>b.qty-a.qty
)
.slice(0,8);







// Low stock


const lowStock =
await prisma.product.findMany({

where:{

companyId:req.user.companyId,


...(storeId !== "ALL" && {
storeId
}),


stockQuantity:{
lte:10
}


},


select:{

id:true,

name:true,

stockQuantity:true

}


});







res.json({

totalRevenue,

totalTransactions,

todayRevenue,

todayTransactions:
todaySales.length,

topProducts,

lowStock


});




}catch(error){

console.error(error);

res.status(500).json({

message:"Failed to load analytics"

});


}


};








// =======================================
// ADVANCED ANALYTICS
// =======================================


export const getAdvancedAnalytics = async(req,res)=>{


try{


const {

period="30",

storeId="ALL"

}=req.query;





const where={


companyId:req.user.companyId,


createdAt:{

gte:new Date(

Date.now()
-
Number(period)
*
24
*
60
*
60
*
1000

)

}


};




if(storeId !== "ALL"){

where.storeId = storeId;

}






const sales =
await prisma.sale.findMany({

where,


include:{

user:true,

saleItems:true

},


orderBy:{
createdAt:"desc"
}


});






// Sales trend


const dailyTrend={};



sales.forEach(sale=>{


const date =
sale.createdAt
.toISOString()
.split("T")[0];



if(!dailyTrend[date]){


dailyTrend[date]={

date,

revenue:0,

count:0

};


}



dailyTrend[date].revenue +=
Number(sale.totalAmount);


dailyTrend[date].count++;




});





const salesTrend =
Object.values(dailyTrend)
.sort(
(a,b)=>
a.date.localeCompare(b.date)
);







// Cashier performance


const cashierMap={};



sales.forEach(sale=>{


const id =
sale.userId;



if(!cashierMap[id]){


cashierMap[id]={


name:
sale.user?.name ||
"Unknown",


totalSales:0,


transactionCount:0


};


}




cashierMap[id].totalSales +=
Number(sale.totalAmount);



cashierMap[id].transactionCount++;




});






const cashierPerformance =
Object.values(cashierMap)
.sort(

(a,b)=>
b.totalSales-a.totalSales

);








res.json({

salesTrend,

cashierPerformance,

totalSales:sales.length,


totalRevenue:

sales.reduce(

(sum,s)=>
sum + Number(s.totalAmount),

0

)


});





}catch(error){


console.error(error);


res.status(500).json({

message:"Failed to load advanced analytics"

});


}



};









// =======================================
// TAX REPORT
// =======================================


export const getTaxReport = async(req,res)=>{


try{


const {

from,

to,

storeId="ALL"

}=req.query;





const where={


companyId:req.user.companyId,


createdAt:{

gte:
from
?
new Date(from)
:
undefined,


lte:
to
?
new Date(to)
:
undefined


}


};




if(storeId !== "ALL"){

where.storeId=storeId;

}





const sales =
await prisma.sale.findMany({

where,

include:{
saleItems:true
}

});






const totalSubtotal =
sales.reduce(

(sum,s)=>

sum+
Number(s.subtotal || 0),

0

);




const totalVat =
sales.reduce(

(sum,s)=>

sum+
Number(s.vatAmount || 0),

0

);




res.json({

period:{
from,
to
},


totalSales:
sales.length,


totalSubtotal,


totalVatCollected:
totalVat,


totalRevenue:
totalSubtotal + totalVat,


vatRate:"18%",


reportGeneratedAt:
new Date().toISOString()


});



}catch(error){


console.error(error);


res.status(500).json({

message:"Failed to generate tax report"

});


}


};