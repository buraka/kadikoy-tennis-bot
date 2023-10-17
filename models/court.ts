import mongoose, { } from 'mongoose';

const CourtSchema = new mongoose.Schema({
    key: String,
    name: String,
    description: String,
    url: String,
    availableSlots: [{
        date: { type: String }
    }]
});

export default mongoose.model('Court', CourtSchema, 'court');
