import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// IRON SHOPS
const ironUpdates = [
  { name: 'Srinu Sanchulu', mobile: '9848613450', name_te: 'శ్రీను సంచులు', landmark_te: 'బైపాస్ గేట్' },
  { name: 'Venkatesh', mobile: '6301954086', name_te: 'వెంకటేష్', landmark_te: 'మెంటాయ్ వారి తోట' },
  { name: 'Ramu', mobile: '9492279929', name_te: 'రాము', landmark_te: 'బి.వి.రాజు విగ్రహం' },
  { name: 'Vinay', mobile: '9885411624', name_te: 'వినయ్', landmark_te: 'డి మార్ట్' },
  { name: 'Thota Ravi', mobile: '6302740077', name_te: 'తోట రవి', landmark_te: 'DNR' },
  { name: 'Chiranjeevi', mobile: '9849280794', name_te: 'చిరంజీవి', landmark_te: 'తాడేరు' },
  { name: 'Yedukodalu', mobile: '8123314166', name_te: 'యెడుకోడలు', landmark_te: 'విస్సాకోడెరు' },
  { name: 'Markandeyulu', mobile: '9502414143', name_te: 'మార్కండేయులు', landmark_te: 'పాలెం సెంటర్' },
  { name: 'Vepakayala Krishna', mobile: '9848231657', name_te: 'వేపకాయల కృష్ణ', landmark_te: 'ఉండి గేట్' },
  { name: 'Reddy Garu', mobile: '9989998638', name_te: 'రెడ్డి గారు', landmark_te: 'ఉండి గేట్' },
  { name: 'Koti Covers', mobile: '9542394942', name_te: 'కోటి కవర్లు', landmark_te: 'రాయలం' },
  { name: 'Satya Narayana', mobile: '9000561162', name_te: 'సత్య నారాయణ', landmark_te: 'రాయలం' },
  { name: 'Kiran Bhasha', mobile: '9290127748', name_te: 'కిరణ్ భాష', landmark_te: 'రాయలం రోడ్డు' },
  { name: 'Dhanraj', mobile: '9573288429', name_te: 'ధనరాజ్', landmark_te: 'గొల్లవనితిప్ప' },
  { name: 'Gollavanitippa Shop', mobile: '9177774075', name_te: 'గొల్లవనితిప్ప షాప్', landmark_te: 'గొల్లవనితిప్ప' },
  { name: 'Srinu DNR', mobile: '9059111960', name_te: 'శ్రీను డిఎన్ఆర్', landmark_te: 'గొల్లవనితిప్ప రోడ్డు' },
  { name: 'Satya Narayana', mobile: '9000163742', name_te: 'సత్య నారాయణ', landmark_te: 'పల్లెపాలెం' },
  { name: 'Suribabu', mobile: '8187851344', name_te: 'సూరిబాబు', landmark_te: 'లోసరి' },
  { name: 'Bhimaraju', mobile: '9908305510', name_te: 'భీమరాజు', landmark_te: 'దిరుసుమర్రు' },
  { name: 'Mahesh', mobile: '9912244377', name_te: 'మహేష్', landmark_te: 'జక్కారం' },
  { name: 'Sugarcane Juice', mobile: '8125621866', name_te: 'చెరకు రసం', landmark_te: 'కల్లా' },
  { name: 'Satish', mobile: '7993704080', name_te: 'సతీష్', landmark_te: 'కల్లా' },
  { name: 'Yallarao', mobile: '9000547874', name_te: 'యల్లారావు', landmark_te: 'కల్లా' },
  { name: 'Narendra', mobile: '7013671991', name_te: 'నరేంద్ర', landmark_te: 'జువ్వలపాలెం' },
  { name: 'Shavukaru', mobile: '9391512697', name_te: 'షావుకారు', landmark_te: 'జువ్వలపాలెం' },
  { name: 'Shankar', mobile: '9603750559', name_te: 'శంకర్', landmark_te: 'జువ్వలపాలెం రోడ్డు' },
  { name: 'Subbarao', mobile: '8106600669', name_te: 'సుబ్బారావు', landmark_te: 'కోలమూరు' },
  { name: 'Naidu', mobile: '9133544044', name_te: 'నాయుడు', landmark_te: 'అкиవిడు' },
  { name: 'Ravi Teja (Chinni)', mobile: '7075660034', name_te: 'రవి తేజ (చిన్ని)', landmark_te: 'అకివిడు' },
  { name: 'Raju', mobile: '9346303494', name_te: 'రాజు', landmark_te: 'అకివిడు' },
  { name: 'Chanti', mobile: '9652847199', name_te: 'చంటి', landmark_te: 'AMC (అకివిడు)' }
]

// WINE SHOPS
const wineUpdates = [
  { name: 'Shiva Wines', mobile: '9381491719', name_te: 'శివ వైన్స్', landmark_te: 'విస్సాకోడెరు', contact_person_te: 'దుండి అశోక్' },
  { name: 'GR Wines', mobile: '9948938799', name_te: 'GR వైన్స్', landmark_te: 'విస్సాకోడెరు', contact_person_te: 'శ్రీ రామ్' },
  { name: 'Swapna Wines', mobile: '9948278799', name_te: 'స్వప్న వైన్స్', landmark_te: 'విస్సాకోదేరు వంతెన', contact_person_te: 'రాజశేఖర్' },
  { name: 'Venkateswara Wines', mobile: '9701155601', name_te: 'వెంకటేశ్వర వైన్స్', landmark_te: 'విస్సాకోదేరు వంతెన', contact_person_te: 'పి. రాము' },
  { name: 'Vijaya Sai Wines', mobile: '9705018411', name_te: 'విజయ సాయి వైన్స్', landmark_te: 'పాలెం సెంటర్', contact_person_te: 'విష్ణువు' },
  { name: 'Satya Krishna Wines', mobile: '9848567677', name_te: 'సత్య కృష్ణ వైన్స్', landmark_te: 'బుధవారం మార్కెట్', contact_person_te: 'డి.ఎస్.ఎన్' },
  { name: 'VL Bar', mobile: '9642247800', name_te: 'విఎల్ బార్', landmark_te: 'బుధవారం మార్కెట్', contact_person_te: 'వర లక్ష్మి బార్' },
  { name: 'Vijaya Beri Wines', mobile: '8125656899', name_te: 'విజయ బేరి వైన్స్', landmark_te: 'బి.వి.రాజు విగ్రహం', contact_person_te: 'శ్రీను పాండు' },
  { name: 'Satya Krishna Bar', mobile: '9848567677', name_te: 'సత్య కృష్ణ బార్', landmark_te: 'నిర్మల వెనుక వైపు', contact_person_te: 'డి.ఎస్.ఎన్' },
  { name: 'Gopi Krishna Bar', mobile: '8247267697', name_te: 'గోపి కృష్ణ బార్', landmark_te: 'టౌన్ స్టేషన్ రోడ్', contact_person_te: 'సాయి' },
  { name: 'Vasu Raju Wines', mobile: '9395592654', name_te: 'వాసు రాజు వైన్స్', landmark_te: 'ఆదా వంటున', contact_person_te: 'వి. రాము' },
  { name: 'Durga Wines', mobile: '9440521343', name_te: 'దుర్గా వైన్స్', landmark_te: 'ఆదా వంటున', contact_person_te: 'సతీష్', type: 'Wine' },
  { name: 'Suchitra Wines', landmark: 'Padmalaya', mobile: '8179147599', name_te: 'సుచిత్ర వైన్స్', landmark_te: 'పద్మాలయ', contact_person_te: 'శివాజీ' },
  { name: 'Suchitra Wines', landmark: 'Town Hall', mobile: '8179147599', name_te: 'సుచిత్ర వైన్స్', landmark_te: 'టౌన్ హాల్', contact_person_te: 'శివాజీ' },
  { name: 'Suchitra Wines', landmark: 'Fire Office', mobile: '8179147599', name_te: 'సుచిత్ర వైన్స్', landmark_te: 'అగ్నిమాపక కార్యాలయం', contact_person_te: 'శివాజీ' },
  { name: 'SR Wines', mobile: '9704596677', name_te: 'SR వైన్స్', landmark_te: 'తాడేరు', contact_person_te: 'వి. భరత్' },
  { name: 'Friends Wines', mobile: '9704450210', name_te: 'ఫ్రెండ్స్ వైన్స్', landmark_te: 'మత్యాపూర్', contact_person_te: 'రాంబాబు' },
  { name: 'Rajesh Wines', mobile: '9908068621', name_te: 'రాజేష్ వైన్స్', landmark_te: 'రాయకుదురు', contact_person_te: 'ఫణి వర్మ' },
  { name: 'MSR Wines', mobile: '9849564236', name_te: 'MSR వైన్స్', landmark_te: 'నౌదురు', contact_person_te: 'నాగ రాజు' },
  { name: 'Vijaya Durga Wines', mobile: '9440521343', name_te: 'విజయ దుర్గా వైన్స్', landmark_te: 'పాలకోడేరు', contact_person_te: 'సతీష్', type: 'Wine' },
  { name: 'Durga Bar', mobile: '9440521343', name_te: 'దుర్గా బార్', landmark_te: 'జువ్వలపాలెం రోడ్డు', contact_person_te: 'సతీష్', type: 'Wine' },
  { name: 'Kasmora Club', mobile: '9154493170', name_te: 'కాస్మోరా క్లబ్', landmark_te: 'జువ్వలపాలెం రోడ్డు' },
  { name: 'Dikshitha Wines', mobile: '9866937730', name_te: 'దీక్షిత వైన్స్', landmark_te: 'దిరుసుమర్రు', contact_person_te: 'వాసు' }
]

// AKIVIDU WINE SHOPS
const akividuUpdates = [
  { name: 'Amrutha Bar', name_te: 'అమృత బార్' },
  { name: 'Amrutha Wines', name_te: 'అమృత వైన్స్' },
  { name: 'Balaram Wines', name_te: 'బలరామ్ వైన్స్' },
  { name: 'Kick Wines', name_te: 'కిక్ వైన్స్', landmark_te: 'డంపగడప' },
  { name: 'Anandh Wines', name_te: 'ఆనంద్ వైన్స్' },
  { name: 'Jalsa Wines', name_te: 'జల్సా వైన్స్' },
  { name: 'Dubai Wines', name_te: 'దుబాయ్ వైన్స్' },
  { name: 'Vinayaka Wines', name_te: 'వినాయక వైన్స్' },
  { name: 'Satya Wines', name_te: 'సత్య వైన్స్', landmark_te: 'సిద్ధపురం' },
  { name: 'OG Wines', name_te: 'ఓజీ వైన్స్' },
  { name: 'Sunandha Wines', name_te: 'సునంద వైన్స్' },
  { name: 'Kunapa Reddy Wines', name_te: 'కునప రెడ్డి వైన్స్' },
  { name: 'Lakshmi Wines', name_te: 'లక్ష్మి వైన్స్' }
]

async function run() {
  console.log('Fetching existing shops...')
  const { data: existingShops, error: fetchError } = await supabase.from('shops').select('*')
  if (fetchError || !existingShops) {
    console.error('Error fetching shops:', fetchError)
    return
  }

  console.log(`Found ${existingShops.length} shops in database. Starting updates...`)

  // Update Iron
  for (const update of ironUpdates) {
    const matched = existingShops.find(s => 
      s.type === 'Iron' && 
      (s.mobile === update.mobile || s.name.toLowerCase() === update.name.toLowerCase())
    )

    if (matched) {
      const payload: any = {
        name_te: update.name_te,
        landmark_te: update.landmark_te
      }
      const { error } = await supabase.from('shops').update(payload).eq('id', matched.id)
      if (error) {
        console.error(`Failed to update ${update.name}:`, error)
      } else {
        console.log(`Updated Iron Shop: ${update.name} (${matched.name}) -> ${update.name_te}`)
      }
    } else {
      console.warn(`No match found for Iron Shop: ${update.name}`)
    }
  }

  // Update Wine
  for (const update of wineUpdates) {
    let matched;
    if (update.landmark) {
      matched = existingShops.find(s => 
        s.type === 'Wine' && 
        s.name.toLowerCase() === update.name.toLowerCase() && 
        s.landmark.toLowerCase() === update.landmark.toLowerCase()
      )
    } else {
      matched = existingShops.find(s => 
        s.type === 'Wine' && 
        s.name.toLowerCase() === update.name.toLowerCase() &&
        s.mobile === update.mobile
      )
    }

    if (matched) {
      const payload: any = {
        name_te: update.name_te,
        landmark_te: update.landmark_te
      }
      if (update.contact_person_te) {
        payload.contact_person_te = update.contact_person_te
      }
      const { error } = await supabase.from('shops').update(payload).eq('id', matched.id)
      if (error) {
        console.error(`Failed to update ${update.name} (${update.landmark || ''}):`, error)
      } else {
        console.log(`Updated Wine Shop: ${update.name} (${matched.name}) -> ${update.name_te}`)
      }
    } else {
      console.warn(`No match found for Wine Shop: ${update.name} (${update.landmark || ''})`)
    }
  }

  // Update Akividu Wine
  for (const update of akividuUpdates) {
    const matched = existingShops.find(s => 
      s.type === 'Akividu Wine' && 
      s.name.toLowerCase() === update.name.toLowerCase()
    )

    if (matched) {
      const payload: any = {
        name_te: update.name_te
      }
      if (update.landmark_te) {
        payload.landmark_te = update.landmark_te
      }
      const { error } = await supabase.from('shops').update(payload).eq('id', matched.id)
      if (error) {
        console.error(`Failed to update ${update.name}:`, error)
      } else {
        console.log(`Updated Akividu Shop: ${update.name} (${matched.name}) -> ${update.name_te}`)
      }
    } else {
      console.warn(`No match found for Akividu Shop: ${update.name}`)
    }
  }

  console.log('All updates complete!')
}

run()
