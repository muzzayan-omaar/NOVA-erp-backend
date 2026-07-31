import prisma from "../../lib/prisma.js";

import {
  toNumber,
  formatDate,
  calculateProfit,
  getDaysAgo,
} from "./analyticsHelper.js";

export const salesAnalytics = async (
    companyId,
    storeId,
    period = 30
) => {

    const where = {

    companyId,

    createdAt:{

        gte:getDaysAgo(period)

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

        saleItems:{

            include:{

                product:true

            }

        }

    },

    orderBy:{

        createdAt:"asc"

    }

});

const trendMap = {};
sales.forEach((sale)=>{

    const date =
        formatDate(sale.createdAt);

    if(!trendMap[date]){

        trendMap[date]={

            date,

            revenue:0,

            profit:0,

            transactions:0

        };

    }

    trendMap[date].revenue +=
        toNumber(sale.totalAmount);

    trendMap[date].transactions++;

    trendMap[date].profit +=
        calculateProfit(sale.saleItems);

});

const salesTrend =

Object.values(trendMap)

.sort(

(a,b)=>

a.date.localeCompare(b.date)

);

const cashierMap={};

sales.forEach((sale)=>{

    if(!cashierMap[sale.userId]){

        cashierMap[sale.userId]={

            name:
            sale.user?.name || "Unknown",

            totalSales:0,

            transactionCount:0

        };

    }

    cashierMap[sale.userId].totalSales +=
        toNumber(sale.totalAmount);

    cashierMap[sale.userId].transactionCount++;

});

const cashierPerformance=

Object.values(cashierMap)

.sort(

(a,b)=>

b.totalSales-a.totalSales

);

const paymentMap={};

sales.forEach((sale)=>{

    if(!paymentMap[sale.paymentMethod]){

        paymentMap[sale.paymentMethod]={

            method:sale.paymentMethod,

            amount:0,

            count:0

        };

    }

    paymentMap[sale.paymentMethod].amount +=
        toNumber(sale.totalAmount);

    paymentMap[sale.paymentMethod].count++;

});

const paymentBreakdown=

Object.values(paymentMap);

const productMap={};

sales.forEach((sale)=>{

    sale.saleItems.forEach((item)=>{

        if(!productMap[item.productId]){

            productMap[item.productId]={

                name:item.product.name,

                quantity:0,

                revenue:0

            };

        }

        productMap[item.productId].quantity +=

            item.quantity;

        productMap[item.productId].revenue +=

            toNumber(item.subtotal);

    });

});

const topProducts=

Object.values(productMap)

.sort(

(a,b)=>

b.revenue-a.revenue

)

.slice(0,10);

return{

    salesTrend,

    cashierPerformance,

    paymentBreakdown,

    topProducts,

    totalSales:sales.length,

    totalRevenue:

    sales.reduce(

        (sum,s)=>

        sum + toNumber(s.totalAmount),

        0

    )

};

};

