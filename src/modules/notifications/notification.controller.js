import {

    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead

} from "./notification.service.js";





export const fetchNotifications = async(req,res)=>{


    try{


        const notifications = await getNotifications({

            companyId:req.user.companyId,

            userId:req.user.id,

            storeId:req.user.activeStoreId

        });



        res.json(notifications);



    }catch(error){

        res.status(500).json({

            message:error.message

        });

    }


};







export const unreadNotifications = async(req,res)=>{


    try{


        const count = await getUnreadCount({

            companyId:req.user.companyId,

            userId:req.user.id,

            storeId:req.user.activeStoreId

        });



        res.json({

            count

        });



    }catch(error){


        res.status(500).json({

            message:error.message

        });


    }


};







export const readNotification = async(req,res)=>{


    try{


        const notification = await markAsRead(
            req.params.id
        );


        res.json(notification);



    }catch(error){


        res.status(500).json({

            message:error.message

        });


    }


};







export const readAllNotifications = async(req,res)=>{


    try{


        await markAllAsRead({

            companyId:req.user.companyId,

            userId:req.user.id

        });



        res.json({

            message:"Notifications marked as read"

        });



    }catch(error){


        res.status(500).json({

            message:error.message

        });


    }


};