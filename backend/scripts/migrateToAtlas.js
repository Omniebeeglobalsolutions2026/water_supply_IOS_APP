const { MongoClient } = require('mongodb');

const localUri = 'mongodb://127.0.0.1:27017';
const atlasUri = 'mongodb+srv://gorantlaashok957_db_user:gOBOxFN9fD9poJgE@cluster0.hcbdzk4.mongodb.net/?retryWrites=true&w=majority';

const localDbName = 'water_supply_management';
const targetDbName = 'water_supply';

async function migrate() {
  console.log('Connecting to Local MongoDB...');
  const localClient = await MongoClient.connect(localUri);
  const localDb = localClient.db(localDbName);
  console.log('✓ Connected to Local MongoDB.');

  console.log('Connecting to MongoDB Atlas Cloud...');
  const atlasClient = await MongoClient.connect(atlasUri);
  const atlasDb = atlasClient.db(targetDbName);
  console.log('✓ Connected to MongoDB Atlas Cloud.');

  const collections = await localDb.listCollections().toArray();
  console.log(`Found ${collections.length} collections in local database.`);

  for (const colInfo of collections) {
    const colName = colInfo.name;
    const docs = await localDb.collection(colName).find({}).toArray();
    console.log(`Migrating "${colName}": ${docs.length} documents...`);

    if (docs.length > 0) {
      const targetCol = atlasDb.collection(colName);
      await targetCol.deleteMany({}); // clean target collection
      await targetCol.insertMany(docs);
      console.log(`✓ "${colName}" migrated successfully!`);
    } else {
      console.log(`- "${colName}" is empty, created collection.`);
      await atlasDb.createCollection(colName).catch(() => {});
    }
  }

  console.log('\n🎉 ALL DATA MIGRATED TO CLOUD ATLAS SUCCESSFULLY!');
  await localClient.close();
  await atlasClient.close();
}

migrate().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
