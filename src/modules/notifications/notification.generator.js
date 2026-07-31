import prisma from "../../lib/prisma.js";

import {
    createNotification
} from "./notification.service.js";



export const generateLowStockNotifications = async(companyId)=>{


    const products = await prisma.product.findMany({

        where:{

            companyId,

            stockQuantity:{
                lte:5
            },

            isActive:true

        }

    });



    for(const product of products){


        await createNotification({

            companyId,

            storeId:product.storeId,


            title:"Low Stock Alert",


            message:
            `${product.name} is running low. Current stock: ${product.stockQuantity}`,


            type:"LOW_STOCK",


            priority:
            product.stockQuantity === 0
            ?
            "CRITICAL"
            :
            "HIGH",


            uniqueKey:
            `LOW_STOCK_${product.id}`,

            metadata:{

                productId:product.id,

                productName:product.name,

                currentStock:product.stockQuantity,

                threshold:5

            }

        });


    }


};