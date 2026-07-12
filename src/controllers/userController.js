import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const getUsers = async (req,res)=>{
 try {

  const users = await prisma.user.findMany({
    where:{
      companyId:req.context.companyId
    },
    select:{
      id:true,
      name:true,
      email:true,
      role:true,
      storeId:true,
      activeStoreId:true,
      isActive:true,
      store:{
        select:{
          id:true,
          name:true
        }
      },
      createdAt:true
    }
  });


  res.json(users);

 } catch(err){

  console.error(err);

  res.status(500).json({
    message:"Failed to fetch users"
  });

 }
};

export const createUser = async(req,res)=>{

try{

const {
 name,
 email,
 password,
 role,
 storeId
}=req.body;


const existing = await prisma.user.findUnique({
 where:{
   companyId_email:{
     companyId:req.context.companyId,
     email
   }
 }
});


if(existing){
 return res.status(400).json({
  message:"User already exists"
 });
}


const passwordHash = await bcrypt.hash(password,10);



const user = await prisma.user.create({

data:{

 companyId:req.context.companyId,

 name,

 email,

 passwordHash,

 role,

 storeId,

 activeStoreId:storeId

}

});


res.status(201).json(user);



}catch(err){

console.error(err);

res.status(500).json({
message:"Failed to create user"
});

}

};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    const updated = await prisma.user.update({
      where: { id },
      data: { name, email, role },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};