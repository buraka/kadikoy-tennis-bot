import mongoose from 'mongoose';
import './models/index';

export default ({ db }) => {

  const connect = () => {
    console.log(db)
    mongoose
      .connect(
        db,
        {}
      )
      .then(() => {
        // tslint:disable-next-line:no-console
        return console.info(`Successfully connected to ${db}`);
      })
      .catch(error => {
        // tslint:disable-next-line:no-console
        console.error('Error connecting to database: ', error);
        return process.exit(1);
      });
  };
  connect();

  mongoose.connection.on('disconnected', connect);
};