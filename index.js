const express = require("express");
const cors = require("cors");
const {MongoClient, ServerApiVersion, ObjectID, ObjectId} = require('mongodb');
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wpgf3.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const productCollection = client.db('industrial').collection('products');
        const reviewCollection = client.db('industrial').collection('reviews');
        const blogCollection = client.db('industrial').collection('blogs');
        const orderCollection = client.db('industrial').collection('orders');
        const paymentCollection = client.db('industrial').collection('payments');

        app.post('/create-payment-intent', async (req, res)=> {
            const order = req.body;
            const price = order.totalPrice;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
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

        //get reviews
        app.get('/reviews', async (req, res) => {
            const limit = parseInt(req.query.limit) || 0;
            const reviews = await reviewCollection.find({}).limit(limit).toArray();
            res.send(reviews);
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











