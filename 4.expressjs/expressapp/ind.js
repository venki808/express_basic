const express = require('express');
const app = express();
app.use(express.json());

app.use((req,res,next) => {
console.log("Request URL : ",req.url);
next();
});

app.post('/user', async(req,res) => {
    try {
const {name, email, password} = req.body;
const result = await pool.query(
    'INSERT INTO users(name, email, password) VALUES($1,$2,$3) RETURNING *',
    [name, email, password]
);
res.status(201).json(result.rows[0]);
    } catch(err){
        console.error(err.message);
        res.status(500).json({error:err.message});
    }
})