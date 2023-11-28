const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// http://localhost:5173/dashboard/users

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    // credentials: true,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.app0kso.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("parcelManagement").collection("users");
    const menuCollection = client.db("parcelManagement").collection("menu");
    const itemCartCollection = client.db("parcelManagement").collection("cart");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365h",
      });
      res.send({ token });
    });

    // middleware
    const verifyToken = (req, res, next) => {
      // console.log('verify Token',req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access token" });
      }
      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // very admin after verifytoken is successful
    //   const verifyAdmin = async(req, res, next) => {
    //     const email = req.decoded.email;
    //     const query = {email: email};
    //     const user =await userCollection.findOne(query);
    //     const isAdmin = user?.role == 'admin';
    //     if(!isAdmin){
    //       return res.status(403).send({message: 'admin not found'})
    //     }
    //     next();

    //   }

    // user collection
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });



    app.get('/users/admin/:email',  async (req, res) => {
      const email = req.params.email;

      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'forbidden access' })
      // }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })




    app.post('/users', async(req, res) => {
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await userCollection.findOne(query)
      if(existingUser){
        return res.send({message : 'user already exists', insertedId:null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })


    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc ={
        $set:{
          role:'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc)
      res.send(result);

    })



    app.patch('/users/deliveryman/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: 'deliveryMan',
          },
        };
    
        const result = await userCollection.updateOne(filter, updateDoc);
    
        if (result.modifiedCount > 0) {
          res.status(200).json({ message: 'User updated to delivery man successfully' });
        } else {
          res.status(404).json({ message: 'User not found or not updated' });
        }
      } catch (error) {
        console.error('Error updating user to delivery man:', error);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    });



    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query)
      res.send(result);

    })



    // menu collection
    app.get("/items", async (req, res) => {
      try {
        const page = parseInt(req.query.page);
        const size = parseInt(req.query.size);

        const result = await menuCollection
          .find()
          .skip(page * size)
          .limit(size)
          .toArray();
        res.send(result);
      } catch (error) {
        res.send(error.message);
      }
    });


      // get single items
      app.get("/items/:id", async (req, res) => {
        const id = req.params.id;
        try {
          const query = {
            _id: new ObjectId(id),
          };
          const result = await menuCollection.findOne(query);
          res.send(result);
        } catch (error) {
          res.status(400).send("item not found");
        }
      });

    app.post("/items", async (req, res) => {
      const newItems = req.body;
      try {
        const result = await menuCollection.insertOne(newItems);
        res.send(result);
      } catch (error) {
        res.send("items not found");
      }
    });

    // update items
    app.put("/items/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateItem = req.body;
      const product = {
        $set: {
          name: updateItem.name,
          price: updateItem.price,
          description: updateItem.description,
          image_url: updateItem.image_url,
          weight: updateItem.weight,
          origin: updateItem.origin,
          stock: updateItem.stock,
          
        },
      };

      const result = await menuCollection.updateOne(filter, product, options);
      res.send(result);
    });

    // delete a item
    app.delete("/items/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      try {
        const result = await menuCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.send("items not found");
      }
    });


// cart collection
 
    // get cart items
    app.get("/itemsCart", async (req, res) => {
      
    //   if (req.user.email !== req.query.email) {
    //     return res.status(403).send({ message: 'forbidden access' })
    // }
        // console.log(req.query.email)
        let query = {};
        if(req.query?.email){
            query = {email:req.query.email}
        }
        // console.log(query)
       const result = await itemCartCollection.find(query).toArray();

        res.send(result)
     
    });

      // add to cart collection
      app.post("/itemsCart", async (req, res) => {
        const newItem = req.body;
     
        try {
          const result = await itemCartCollection.insertOne(newItem);
          res.send(result);
        } catch (error) {
          res.send("items not found");
        }
      });


      app.patch('/itemsCart/onTheWay/:id', async (req, res) => {
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)}
        const updateDoc ={
          $set:{
            status:'On The Way'
          }
        }
        const result = await itemCartCollection.updateOne(filter, updateDoc)
        res.send(result);
  
      })


      app.delete("/itemsCart/:id", async (req, res) => {
        const id = req.params.id;
        // console.log(id);
        const query = {_id:new ObjectId(id) };
  
        const result = await itemCartCollection.deleteOne(query);
        // console.log(result);
        res.send(result);
      });




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Bistro boss is sitting on port ${port}`);
});
