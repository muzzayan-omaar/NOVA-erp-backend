import prisma from "../../lib/prisma.js";


// Create notification
export const createNotification = async(data)=>{

    try{

        return await prisma.notification.create({

            data

        });


    }catch(error){


        // duplicate uniqueKey protection
        if(error.code === "P2002"){

            return null;

        }


        throw error;

    }

};



// Get notifications for user/store/company
export const getNotifications = async({
    companyId,
    userId,
    storeId
})=>{


    return await prisma.notification.findMany({

        where:{

            companyId,

            OR:[

                {
                    userId
                },

                {
                    userId:null,
                    storeId
                },

                {
                    userId:null,
                    storeId:null
                }

            ]

        },

        orderBy:{

            createdAt:"desc"

        }


    });


};




// unread count

export const getUnreadCount = async({
    companyId,
    userId,
    storeId
})=>{


    return await prisma.notification.count({

        where:{

            companyId,

            isRead:false,


            OR:[

                {
                    userId
                },


                {
                    userId:null,
                    storeId
                },


                {
                    userId:null,
                    storeId:null
                }

            ]

        }

    });


};




// mark single notification read

export const markAsRead = async(id)=>{


    return await prisma.notification.update({

        where:{
            id
        },

        data:{
            isRead:true
        }

    });


};



// mark all notifications read

export const markAllAsRead = async({
    companyId,
    userId
})=>{


    return await prisma.notification.updateMany({

        where:{

            companyId,

            isRead:false,

            OR:[

                {
                    userId
                },

                {
                    userId:null
                }

            ]

        },


        data:{

            isRead:true

        }


    });


};