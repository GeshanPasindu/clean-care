import express from "express"

const router = express.Router();

import {addClient,updateClientById ,getAllClientCount,deleteClientById,getClientById,getAllClient,getAllActiveClient,getAllClientPagination,updateStatus} from "../controllers/clientController.js"
import { authenticate, requireRoles } from "../middleware/authentication.js";
import { requireOwnedRecord } from "../middleware/authorization.js";
import Client from "../models/clientModel.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

router.use(authenticate);

router.post("/addClient", requireRoles("superAdmin", "admin"), asyncHandler(addClient));
router.put("/updateClientById/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Client), asyncHandler(updateClientById));
router.delete("/deleteClientById/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Client), asyncHandler(deleteClientById));
router.get("/getClientById/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Client), asyncHandler(getClientById));
router.get("/getAllClientPagination", requireRoles("superAdmin", "admin"), asyncHandler(getAllClientPagination));
router.get("/getAllActiveClient", requireRoles("superAdmin", "admin"), asyncHandler(getAllActiveClient));
router.get("/getAllClient", requireRoles("superAdmin", "admin"), asyncHandler(getAllClient));
router.patch("/updateStatus/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Client), asyncHandler(updateStatus));
router.get("/getAllClientCount", requireRoles("superAdmin", "admin"), asyncHandler(getAllClientCount));

export default router;
