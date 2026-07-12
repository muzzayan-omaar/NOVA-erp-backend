import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

/**
 * GET ALL INVENTORY MOVEMENTS
 * Scoped by company + active store
 */
export const getMovements = async (req, res) => {
  try {
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        companyId: req.context.companyId,
        storeId: req.context.storeId,
      },
      include: {
        product: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(movements);

  } catch (error) {
    console.error("GET MOVEMENTS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch inventory movements",
    });
  }
};


/**
 * ADJUST STOCK
 */
export const adjustStock = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      type,
      reason,
    } = req.body;


    if (!productId || !quantity || !type) {
      return res.status(400).json({
        message: "Product, quantity and movement type are required",
      });
    }


    const qty = Number(quantity);


    if (qty <= 0) {
      return res.status(400).json({
        message: "Quantity must be greater than zero",
      });
    }


    /**
     * Find product only inside current company/store
     */
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        companyId: req.context.companyId,
        storeId: req.context.storeId,
      },
    });


    if (!product) {
      return res.status(404).json({
        message: "Product not found in current store",
      });
    }



    let newStock = product.stockQuantity || 0;


    /**
     * Stock logic
     */
    if (
      type === "IN"
    ) {
      newStock += qty;
    }


    if (
      type === "OUT" ||
      type === "SALE"
    ) {
      newStock -= qty;
    }


    if (type === "ADJUSTMENT") {
      newStock = qty;
    }


    if (newStock < 0) {
      return res.status(400).json({
        message: "Insufficient stock",
      });
    }



    /**
     * Transaction:
     * 1. Update product
     * 2. Create movement
     */
    const result = await prisma.$transaction(async (tx) => {


      const updatedProduct = await tx.product.update({
        where:{
          id:product.id,
        },
        data:{
          stockQuantity:newStock,
        },
      });



      const movement = await tx.inventoryMovement.create({
        data:{
          companyId:req.context.companyId,
          storeId:req.context.storeId,

          productId:product.id,

          createdById:req.context.userId,

          type,
          quantity:qty,
          reason,
        },
      });



      return {
        updatedProduct,
        movement,
      };

    });



    await createAuditLog({
      userId:req.context.userId,

      action:"INVENTORY_ADJUSTED",

      entityType:"inventory_movement",

      entityId:result.movement.id,

      metadata:{
        productId,
        type,
        quantity:qty,
        newStock,
      },
    });



    res.json({
      message:"Stock updated successfully",

      product:result.updatedProduct,

      movement:result.movement,
    });



  } catch(error){

    console.error("ADJUST STOCK ERROR:",error);

    res.status(500).json({
      message:"Failed to adjust stock",
    });

  }
};