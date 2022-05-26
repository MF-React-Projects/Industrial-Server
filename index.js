const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const {MongoClient, ServerApiVersion, ObjectId} = require('mongodb');
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wpgf3.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1});

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({error: 'Unathorized access'});
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).json({error: 'Forbidden access'});
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const productCollection = client.db('industrial').collection('products');
        const reviewCollection = client.db('industrial').collection('reviews');
        const blogCollection = client.db('industrial').collection('blogs');
        const orderCollection = client.db('industrial').collection('orders');
        const paymentCollection = client.db('industrial').collection('payments');
        const userCollection = client.db('industrial').collection('users');

        app.post('/create-payment-intent', async (req, res) => {
            const order = req.body;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: order.totalPrice,
                currency: 'usd',
                payment_method_types: ['card'],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        //get products
        app.get('/products', async (req, res) => {
            const limit = parseInt(req.query.limit) || 0;
            const products = await productCollection.find({}).limit(limit).toArray();
            res.send(products);
        });

        //get blogs
        app.get('/blogs', async (req, res) => {
            const limit = parseInt(req.query.limit) || 0;
            const blogs = await blogCollection.find({}).limit(limit).toArray();
            res.send(blogs);
        });

        //get product by id
        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const product = await productCollection.findOne({_id: ObjectId(id)});
            res.send(product);
        });

        //post order
        app.post('/order', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            if (result) {
                res.send({success: true});
            } else {
                res.send({success: false});
            }
        });

        //get order by id
        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            const order = await orderCollection.findOne({_id: ObjectId(id)});
            res.send(order);
        });

        //update order
        app.patch('/order/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)};
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const order = await orderCollection.updateOne(filter, updatedDoc);
            res.send({result, order});
        })

        //delete order by id
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const result = await orderCollection.deleteOne({_id: ObjectId(id)});
            if (result) {
                res.send({success: true});
            } else {
                res.send({success: false});
            }
        });

        //get orders by user email
        app.get('/orders/:email', async (req, res) => {
            const email = req.params.email;
            const orders = await orderCollection.find({email: email}).toArray();
            res.send(orders);
        });

        //reduce product quantity
        app.put('/product/:id', async (req, res) => {
            const id = req.params.id;
            const product = await productCollection.findOne({_id: new ObjectId(id)});
            const newQuantity = req.body.inStock;
            const result = await productCollection.updateOne({_id: new ObjectId(id)}, {$set: {inStock: newQuantity}});
            if (result) {
                res.send({success: true});
            } else {
                res.send({success: false});
            }
        });

        /*
        * Review
        */
        //get reviews
        app.get('/reviews', async (req, res) => {
            const limit = parseInt(req.query.limit) || 0;
            //lastest first
            const reviews = await reviewCollection.find({}).sort({_id: -1}).limit(limit).toArray();
            res.send(reviews);
        });
        //post review
        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            if (result) {
                res.send({success: true});
            } else {
                res.send({success: false});
            }
        });

        /*
        * User
        * */
        //get all users
        app.get('/users', verifyJWT, async (req, res) => {
            const users = await userCollection.find({}).toArray();
            res.send(users);
        })

        //
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({email: requester});
            if (requesterAccount.role !== 'admin') {
                return res.status(403).json({message: 'Forbidden access'});
            }
            const filter = {email: email};
            const updateDoc = {
                $set: {role: 'admin'}
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            const token = jwt.sign({email: email}, process.env.JWT_SECRET, {expiresIn: '1d'});
            res.send({result, token});
        })

        //
        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin});
        })

        //update user
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body
            const filter = {email: email};
            const options = {upsert: true};
            const updateDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({email: email}, process.env.JWT_SECRET, {expiresIn: '1d'});
            res.send({result, token});
        })


    } finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Running on port ' + port);
});

app.listen(port, () => {
    console.log('Server running on port ' + port);
});











