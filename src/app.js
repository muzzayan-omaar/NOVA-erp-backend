import express from "express";
import cors from "cors";
import rateLimit from 'express-rate-limit';

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
import payrollRoutes from "./routes/payrollRoutes.js";
import storeRoutes from "./routes/storeRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";

import notificationRoutes from "./modules/notifications/notification.routes.js";

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})

app.use(cors());
app.use(express.json());
app.use(limiter);



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
app.use("/api/payroll", payrollRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/reports", reportsRoutes);
app.use(
    "/api/notifications",
    notificationRoutes
);

export default app;