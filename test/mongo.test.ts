import * as dotenv from "dotenv";
dotenv.config();
import { MongoClient } from "mongodb";

async function testConnection() {
    const uri = process.env.MONGODB_ATLAS_URI || "";
    if (!uri) {
        console.error("MONGODB_ATLAS_URI is not defined in .env");
        return;
    }

    console.log("Attempting to connect to MongoDB...");
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Successfully connected to MongoDB!");
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch (error) {
        console.error("Connection failed:");
        console.error(error);
    } finally {
        await client.close();
    }
}

testConnection();
