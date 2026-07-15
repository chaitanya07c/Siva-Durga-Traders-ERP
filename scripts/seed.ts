import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const ironShops = [
  { name: 'Srinu Sanchulu', type: 'Iron', landmark: 'By Pass Gate', mobile: '9848613450' },
  { name: 'Venkatesh', type: 'Iron', landmark: 'Mentay Vari Thota', mobile: '6301954086' },
  { name: 'Ramu', type: 'Iron', landmark: 'B.V.Raju Statue', mobile: '9492279929' },
  { name: 'Vinay', type: 'Iron', landmark: 'D Mart', mobile: '9885411624' },
  { name: 'Thota Ravi', type: 'Iron', landmark: 'DNR', mobile: '6302740077' },
  { name: 'Chiranjeevi', type: 'Iron', landmark: 'Taderu', mobile: '9849280794' },
  { name: 'Yedukodalu', type: 'Iron', landmark: 'Vissakoderu', mobile: '8123314166' },
  { name: 'Markandeyulu', type: 'Iron', landmark: 'Palem Center', mobile: '9502414143' },
  { name: 'Vepakayala Krishna', type: 'Iron', landmark: 'Undi Gate', mobile: '9848231657' },
  { name: 'Reddy Garu', type: 'Iron', landmark: 'Undi Gate', mobile: '9989998638' },
  { name: 'Koti Covers', type: 'Iron', landmark: 'Rayalam', mobile: '9542394942' },
  { name: 'Satya Narayana', type: 'Iron', landmark: 'Rayalam', mobile: '9000561162' },
  { name: 'Kiran Bhasha', type: 'Iron', landmark: 'Rayalam Road', mobile: '9290127748' },
  { name: 'Dhanraj', type: 'Iron', landmark: 'Gollavanitippa', mobile: '9573288429' },
  { name: 'Gollavanitippa Shop', type: 'Iron', landmark: 'Gollavanitippa', mobile: '9177774075' },
  { name: 'Srinu DNR', type: 'Iron', landmark: 'Gollavanitippa Road', mobile: '9059111960' },
  { name: 'Satya Narayana', type: 'Iron', landmark: 'Pallepalem', mobile: '9000163742' },
  { name: 'Suribabu', type: 'Iron', landmark: 'Losari', mobile: '8187851344' },
  { name: 'Bhimaraju', type: 'Iron', landmark: 'Dirusumarru', mobile: '9908305510' },
  { name: 'Mahesh', type: 'Iron', landmark: 'Jakkaram', mobile: '9912244377' },
  { name: 'Sugarcane Juice', type: 'Iron', landmark: 'Kalla', mobile: '8125621866' },
  { name: 'Satish', type: 'Iron', landmark: 'Kalla', mobile: '7993704080' },
  { name: 'Yallarao', type: 'Iron', landmark: 'Kalla', mobile: '9000547874' },
  { name: 'Narendra', type: 'Iron', landmark: 'Juvvalapalem', mobile: '7013671991' },
  { name: 'Shavukaru', type: 'Iron', landmark: 'Juvvalapalem', mobile: '9391512697' },
  { name: 'Shankar', type: 'Iron', landmark: 'Juvvalapalem Road', mobile: '9603750559' },
  { name: 'Subbarao', type: 'Iron', landmark: 'Kolamuru', mobile: '8106600669' },
  { name: 'Naidu', type: 'Iron', landmark: 'Akividu', mobile: '9133544044' },
  { name: 'Ravi Teja (Chinni)', type: 'Iron', landmark: 'Akividu', mobile: '7075660034' },
  { name: 'Raju', type: 'Iron', landmark: 'Akividu', mobile: '9346303494' },
  { name: 'Chanti', type: 'Iron', landmark: 'AMC, Akividu', mobile: '9652847199' }
]

const wineShops = [
  { name: 'Shiva Wines', type: 'Wine', landmark: 'Vissakoderu', contact_person: 'Dundi Ashok', mobile: '9381491719' },
  { name: 'GR Wines', type: 'Wine', landmark: 'Vissakoderu', contact_person: 'Sri Ram', mobile: '9948938799' },
  { name: 'Swapna Wines', type: 'Wine', landmark: 'Vissakoderu Bridge', contact_person: 'Rajashekar', mobile: '9948278799' },
  { name: 'Venkateswara Wines', type: 'Wine', landmark: 'Vissakoderu Bridge', contact_person: 'P. Ramu', mobile: '9701155601' },
  { name: 'Vijaya Sai Wines', type: 'Wine', landmark: 'Palem Centre', contact_person: 'Vishnu', mobile: '9705018411' },
  { name: 'Satya Krishna Wines', type: 'Wine', landmark: 'Wednesday Market', contact_person: 'D.S.N', mobile: '9848567677' },
  { name: 'VL Bar', type: 'Wine', landmark: 'Wednesday Market', contact_person: 'Vara Lakshmi Bar', mobile: '9642247800' },
  { name: 'Vijaya Beri Wines', type: 'Wine', landmark: 'B.V.Raju Statue', contact_person: 'Srinu Pandu', mobile: '8125656899' },
  { name: 'Satya Krishna Bar', type: 'Wine', landmark: 'Nirmala Back Side', contact_person: 'D.S.N', mobile: '9848567677' },
  { name: 'Gopi Krishna Bar', type: 'Wine', landmark: 'Town Station Road', contact_person: 'Sai', mobile: '8247267697' },
  { name: 'Vasu Raju Wines', type: 'Wine', landmark: 'Aadha Vantuna', contact_person: 'V. Ramu', mobile: '9395592654' },
  { name: 'Durga Wines', type: 'Wine', landmark: 'Aadha Vantuna', contact_person: 'Sathish', mobile: '9440521343' },
  { name: 'Suchitra Wines', type: 'Wine', landmark: 'Padmalaya', contact_person: 'Shivaji', mobile: '8179147599' },
  { name: 'Suchitra Wines', type: 'Wine', landmark: 'Town Hall', contact_person: 'Shivaji', mobile: '8179147599' },
  { name: 'Suchitra Wines', type: 'Wine', landmark: 'Fire Office', contact_person: 'Shivaji', mobile: '8179147599' },
  { name: 'SR Wines', type: 'Wine', landmark: 'Taderu', contact_person: 'V. Bharath', mobile: '9704596677' },
  { name: 'Friends Wines', type: 'Wine', landmark: 'Matyapur', contact_person: 'Rambabu', mobile: '9704450210' },
  { name: 'Rajesh Wines', type: 'Wine', landmark: 'Rayakuduru', contact_person: 'Phani Varma', mobile: '9908068621' },
  { name: 'MSR Wines', type: 'Wine', landmark: 'Nowduru', contact_person: 'Naga Raju', mobile: '9849564236' },
  { name: 'Vijaya Durga Wines', type: 'Wine', landmark: 'Palakoderu', contact_person: 'Satish', mobile: '9440521343' },
  { name: 'Durga Bar', type: 'Wine', landmark: 'Juvvalapalem Road', contact_person: 'Satish', mobile: '9440521343' },
  { name: 'Kasmora Club', type: 'Wine', landmark: 'Juvvalapalem Road', mobile: '9154493170' },
  { name: 'Dikshitha Wines', type: 'Wine', landmark: 'Dirusumarru', contact_person: 'Vasu', mobile: '9866937730' }
]

const akividuWineShops = [
  { name: 'Amrutha Bar', type: 'Akividu Wine' },
  { name: 'Amrutha Wines', type: 'Akividu Wine' },
  { name: 'Balaram Wines', type: 'Akividu Wine' },
  { name: 'Kick Wines', type: 'Akividu Wine', landmark: 'Dumpagadapa' },
  { name: 'Anandh Wines', type: 'Akividu Wine' },
  { name: 'Jalsa Wines', type: 'Akividu Wine' },
  { name: 'Dubai Wines', type: 'Akividu Wine' },
  { name: 'Vinayaka Wines', type: 'Akividu Wine' },
  { name: 'Satya Wines', type: 'Akividu Wine', landmark: 'Siddapuram' },
  { name: 'OG Wines', type: 'Akividu Wine' },
  { name: 'Sunandha Wines', type: 'Akividu Wine' },
  { name: 'Kunapa Reddy Wines', type: 'Akividu Wine' },
  { name: 'Lakshmi Wines', type: 'Akividu Wine' }
]

const bottleBrands = [
  'Kingfisher Red', 'Kingfisher Green', 'Kingfisher White', 'Budweiser', 
  'Kajora', '10000', 'MC Whisky', 'Mansion House', 'Imperial Blue', 
  'Royal Stag', 'IconiQ', 'Sterling Reserve B7', 'Breezer'
]

const otherMaterials = [
  'White Glass', 'Colour Glass', 'Plastic', 'Plastic Cover', 
  'Water Bottles', 'Iron', 'Books', 'Atta'
]

async function seed() {
  console.log('Seeding data...')
  
  // Seed Shops
  const allShops = [...ironShops, ...wineShops, ...akividuWineShops]
  const { error: shopsError } = await supabase.from('shops').insert(allShops)
  if (shopsError) {
    console.error('Error inserting shops:', shopsError)
  } else {
    console.log(`Inserted ${allShops.length} shops successfully.`)
  }

  // Seed Materials
  const allMaterials = [
    ...bottleBrands.map(name => ({ name, category: 'Bottle Brand' })),
    ...otherMaterials.map(name => ({ name, category: 'Other Material' }))
  ]
  const { error: matsError } = await supabase.from('materials').insert(allMaterials)
  if (matsError) {
    console.error('Error inserting materials:', matsError)
  } else {
    console.log(`Inserted ${allMaterials.length} materials successfully.`)
  }

  console.log('Seeding complete!')
}

seed().catch(console.error)
