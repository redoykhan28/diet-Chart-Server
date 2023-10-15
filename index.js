const express = require("express")
const cors = require("cors")
const jwt = require('jsonwebtoken');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000

//middle ware
app.use(cors())
app.use(express.json())

//middlewear for varify jwt
function jwtVerify(req, res, next) {

    const authHeader = req.headers.authorization;
    // console.log(authHeader)
    if (!authHeader) {

        return res.status(401).send('Unothorized User')
    }

    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {

        if (error) {

            return res.status(403).send('Forbbiden access')
        }

        req.decoded = decoded

        next()

    })

}

app.get('/', (req, res) => {

    res.send("Diet Chart is running")
})

//conecting database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.g9lyrzf.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        // strict: true,
        deprecationErrors: true,
    }
});



async function run() {

    try {

        //db for foodList
        const foodCollection = client.db('diet-chart').collection('food-list')

        //db for users
        const usersCollection = client.db('diet-chart').collection('users')



        //get jwt by user email
        app.get('/jwt', async (req, res) => {

            const email = req.query.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)

            //send jwt to client
            if (user) {

                const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '30d' })
                return res.send({ accessToken: token })

            }

            res.status(403).send({ accessToken: '' })

        })

        //create admin
        app.put('/admin/:id', jwtVerify, async (req, res) => {

            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updatedDoc = {

                $set: {
                    role: 'admin'
                }
            }

            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })


        //verify admin
        const verifyAdmin = async (req, res, next) => {

            //verify
            const decodedEmail = req.decoded.email;
            const AdminQuery = { email: decodedEmail }
            const user = await usersCollection.findOne(AdminQuery)

            if (user?.role !== 'admin') {

                return res.status(403).send('Forbidden Access');
            }
            next()

        }

        //verify user
        const verifyUser = async (req, res, next) => {

            //verify
            const decodedEmail = req.decoded.email;
            const UsersQuery = { email: decodedEmail }
            const user = await usersCollection.findOne(UsersQuery)

            if (user?.role !== 'user') {

                return res.status(403).send('Forbidden Access');
            }
            next()

        }

        //get admin  to authorized route
        app.get('/user/admin/:email', async (req, res) => {

            const email = req.params.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query)
            res.send({ isAdmin: result?.role === 'admin' })


        })

        //get users  to authorized route
        app.get('/user/users/:email', async (req, res) => {

            const email = req.params.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query)
            res.send({ isUser: result?.role === 'user' })

        })



        //post users
        app.post('/users', async (req, res) => {

            const user = req.body;
            const findLast = await usersCollection.findOne({}, { sort: { _id: -1 } })
            let lastUserId = 0
            const lastId = findLast.id
            console.log(lastId)
            if (findLast) {
                lastUserId = findLast.id || 0
                lastUserId++
            }
            user.id = lastUserId.toString()
            const existingUser = await usersCollection.findOne({ email: user.email });
            if (existingUser) {
                // Update the existing user's information or return an error
                // You can decide how to handle duplicates here
                res.status(409).json({ error: 'User already exists' });
            } else {
                // Insert the new user since they don't exist in the database
                const result = await usersCollection.insertOne(user);
                res.send(result);
            }

        })

        //post foodlist
        app.post('/charts', jwtVerify, verifyAdmin, async (req, res) => {

            const user = req.body;
            let lastFoodId = 0
            const findLast = await foodCollection.findOne({}, { sort: { _id: -1 } })
            const lastId = findLast.id
            console.log(lastId)
            if (findLast) {
                lastFoodId = findLast.id || 0
                lastFoodId++
            }
            user.id = lastFoodId.toString()
            const result = await foodCollection.insertOne(user)
            res.send(result)

        })

        //get food list

        // Create the text index for the "food-list" collection
        foodCollection.createIndex({ name: "text" });


        app.get('/foodlist', async (req, res) => {
            try {
                let search = req.query.search;
                // console.log(search)

                let query = {};

                if (search && search.length > 0) {
                    // Create a regular expression to match items that start with the search string
                    const regex = new RegExp(`^${search}`, 'i');

                    query = {
                        name: { $regex: regex }
                    };
                }


                const cursor = foodCollection.find(query);
                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                console.error("Error in /foodlist:", error);
                res.status(500).send("Internal Server Error");
            }
        });

        //get food list
        app.get('/adfoodlist', jwtVerify, verifyAdmin, async (req, res) => {

            const query = {}
            const cursor = foodCollection.find(query)
            const result = await cursor.sort({ _id: -1 }).toArray()
            res.send(result)

        })

        //get user list
        app.get('/totalUser', jwtVerify, verifyAdmin, async (req, res) => {

            const query = {}
            const cursor = usersCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)

        })

        //delete Food
        app.delete('/deleteFoods/:id', jwtVerify, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await foodCollection.deleteOne(query)
            res.send(result)
        })

    }

    finally {

    }
}

run().catch(console.dir)


app.listen(port, () => {

    console.log(`Server runs on port ${port}`)
})