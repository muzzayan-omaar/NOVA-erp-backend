import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import paymentsRoutes from "./routes/paymentsRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "🚀 Nova ERP Backend Running Successfully" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/users", userRoutes);

export default app;