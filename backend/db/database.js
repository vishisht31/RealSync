import mongoose from 'mongoose'

// MongoDB Connection

const connectDB = async ()=>{
    try{
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        })
        console.log(`\n MongoDB connected !! DB Host: ${connectionInstance.connection.host}`)
    } catch(err){
        console.error("MongoDB Connection Failed: ",err)
        process.exit(1)
    }
}
export default connectDB

// await mongoose.connect(MONGODB_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
// })
// .then(() => console.log('MongoDB connected'))
// .catch(err => console.error('MongoDB connection error:', err));