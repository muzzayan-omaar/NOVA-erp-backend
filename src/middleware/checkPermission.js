import { permissions } from "../utils/permissions.js";


const checkPermission = (permission)=>{

  return (req,res,next)=>{

    try {

      const role = req.user.role;

      


      const allowedPermissions =
        permissions[role] || [];


      if(!allowedPermissions.includes(permission)){

        

        return res.status(403).json({
          message:
          "You do not have permission to access this resource"
        });

      }


     

      next();


    } catch(error){

      console.error(error);

      res.status(500).json({
        message:"Permission check failed"
      });

    }


  };


};


export default checkPermission;