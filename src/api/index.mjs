import express from 'express';

const router = new express.Router();

router.use("/v1", (req, res, next)=>{
res.status(200).json("version 1")
});

export default router;