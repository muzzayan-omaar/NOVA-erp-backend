export const emitNotification = (io, notification) => {

    if(!io) return;


    // company-wide notifications
    io.to(
        `company:${notification.companyId}`
    )
    .emit(
        "notification:new",
        notification
    );


    // specific store
    if(notification.storeId){

        io.to(
            `store:${notification.storeId}`
        )
        .emit(
            "notification:new",
            notification
        );

    }


    // specific user
    if(notification.userId){

        io.to(
            `user:${notification.userId}`
        )
        .emit(
            "notification:new",
            notification
        );

    }


};