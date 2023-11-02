import mongoose, { } from 'mongoose';
import { COURT_TYPE } from '../constants';

const CourtSchema = new mongoose.Schema({
    key: String,
    name: String,
    description: String,
    url: String,
    type: {
        type: String,
        enum: [COURT_TYPE.FOOTBALL, COURT_TYPE.OLLEYY_FOOTBALL, COURT_TYPE.TENNIS],
        default: COURT_TYPE.TENNIS
    },
    availableSlots: [{
        date: { type: String }
    }]
});

export default mongoose.model('Court', CourtSchema, 'court');
