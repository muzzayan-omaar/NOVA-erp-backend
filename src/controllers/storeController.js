import prisma from "../lib/prisma.js";

/**
 * CREATE STORE (branch)
 */
export const createStore = async (req, res) => {
  try {
    const { name, location, phone, isHeadOffice } = req.body;

    const store = await prisma.store.create({
      data: {
        name,
        location,
        phone,
        isHeadOffice: isHeadOffice || false,
        isActive: true,
        companyId: req.context.companyId,
      },
    });

    res.status(201).json(store);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create store" });
  }
};

/**
 * GET STORES (ONLY FOR THIS COMPANY)
 */
export const getStores = async (req, res) => {
  try {
    const stores = await prisma.store.findMany({
      where: {
        companyId: req.context.companyId,
      },
      orderBy:{
        createdAt:"asc"
      }
    });

    res.json(stores);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message:"Failed to fetch stores"
    });
  }
};

/**
 * SWITCH ACTIVE STORE (REAL VERSION)
 */
export const switchStore = async (req, res) => {
  try {
    const { storeId } = req.body;

    const store = await prisma.store.findFirst({
  where:{
    id:storeId,
    companyId:req.context.companyId,
    isActive:true
  }
});


if(!store){
 return res.status(404).json({
   message:"Store not available"
 });
}

    // Update user's active store
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { activeStoreId: storeId },
      include: { activeStore: true }
    });

    res.json({
      message: "Store switched",
      user: updatedUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to switch store" });
  }
};

/**
 * GET CURRENT STORE
 */
export const getCurrentStore = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.context.userId },
      include: {
        activeStore: true,
        store: true,
      },
    });

    res.json(user.activeStore || user.store);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get current store" });
  }
};

export const toggleStoreStatus = async (req,res)=>{
  try {

    const { id } = req.params;
    const { isActive } = req.body;


    const store = await prisma.store.findFirst({
      where:{
        id,
        companyId:req.context.companyId
      }
    });


    if(!store){
      return res.status(404).json({
        message:"Store not found"
      });
    }


    const updatedStore = await prisma.store.update({
      where:{
        id
      },
      data:{
        isActive
      }
    });


    res.json({
      message:"Store status updated",
      store:updatedStore
    });


  } catch(error){

    console.error(error);

    res.status(500).json({
      message:"Failed to update store status"
    });

  }
};