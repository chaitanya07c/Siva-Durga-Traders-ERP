-- ============================================================================
-- SIVA DURGA TRADERS ERP - CLEAN INITIAL SEED DATA (Production v2.0)
-- Contains only master catalog, category, standard shop registry, and default workers.
-- Does NOT contain any transactional data (purchases, sales, payments, expenses).
-- ============================================================================

-- ============================================================================
-- 1. SEED MATERIALS / PRODUCTS CATALOG
-- ============================================================================

-- Beer Bottles (Unit: Nos)
INSERT INTO public.materials (name, name_te, category, category_te, default_cost, unit) VALUES
('Kingfisher [Red]', 'కింగ్‌ఫిషర్ [రెడ్]', 'Beer Bottles', 'బీర్ బాటిల్స్', 0.00, 'Nos'),
('Kingfisher [Green]', 'కింగ్‌ఫిషర్ [గ్రీన్]', 'Beer Bottles', 'బీర్ బాటిల్స్', 0.00, 'Nos'),
('Kingfisher [White]', 'కింగ్‌ఫిషర్ [వైట్]', 'Beer Bottles', 'బీర్ బాటిల్స్', 0.00, 'Nos'),
('Budweiser', 'బడ్‌వైజర్', 'Beer Bottles', 'బీర్ బాటిల్స్', 0.00, 'Nos'),
('Kajora', 'కజోర', 'Beer Bottles', 'బీర్ బాటిల్స్', 0.00, 'Nos'),
('10,000', '10,000', 'Beer Bottles', 'బీర్ బాటిల్స్', 0.00, 'Nos')
ON CONFLICT DO NOTHING;

-- Liquor Bottles (Unit: Kg)
INSERT INTO public.materials (name, name_te, category, category_te, default_cost, unit) VALUES
('MC Whisky', 'ఎంసి విస్కీ', 'Liquor Bottles', 'లిక్కర్ బాటిల్స్', 0.00, 'Kg'),
('Mansion House', 'మాన్షన్ హౌస్', 'Liquor Bottles', 'లిక్కర్ బాటిల్స్', 0.00, 'Kg'),
('Imperial Blue', 'ఇంపీరియల్ బ్లూ', 'Liquor Bottles', 'లిక్కర్ బాటిల్స్', 0.00, 'Kg'),
('Royal Stag', 'రాయల్ స్టాగ్', 'Liquor Bottles', 'లిక్కర్ బాటిల్స్', 0.00, 'Kg'),
('IconiQ', 'ఐకానిక్', 'Liquor Bottles', 'లిక్కర్ బాటిల్స్', 0.00, 'Kg'),
('Sterling Reserve B7', 'స్టెర్లింగ్ రిజర్వ్ B7', 'Liquor Bottles', 'లిక్కర్ బాటిల్స్', 0.00, 'Kg'),
('Breezer', 'బ్రీజర్', 'Liquor Bottles', 'లిక్కర్ బాటిల్స్', 0.00, 'Kg')
ON CONFLICT DO NOTHING;

-- Other Materials / Items
INSERT INTO public.materials (name, name_te, category, category_te, default_cost, unit) VALUES
('White Glass', 'తెల్ల గ్లాస్', 'Other Items', 'ఇతర వస్తువులు', 0.00, 'Nos'),
('Colour Glass', 'కలర్ గ్లాస్', 'Other Items', 'ఇతర వస్తువులు', 0.00, 'Nos'),
('Plastic', 'ప్లాస్టిక్', 'Other Items', 'ఇతర వస్తువులు', 0.00, 'Kg'),
('Plastic Cover', 'ప్లాస్టిక్ కవర్', 'Other Items', 'ఇతర వస్తువులు', 0.00, 'Nos'),
('Water Bottles', 'వాటర్ బాటిల్స్', 'Other Items', 'ఇతర వస్తువులు', 0.00, 'Nos'),
('Iron', 'ఐరన్', 'Other Items', 'ఇతర వస్తువులు', 0.00, 'Kg'),
('Books', 'బుక్స్', 'Other Items', 'ఇతర వస్తువులు', 0.00, 'Nos'),
('Atta', 'అట్ట', 'Other Items', 'ఇతర వస్తువులు', 0.00, 'Kg')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. SEED DEFAULT BUYERS DIRECTORY
-- ============================================================================
INSERT INTO public.buyers (name, name_te, mobile) VALUES
('Babi Garu [Rjy]', 'బాబి గారు [రాజమండ్రి]', NULL),
('Subuid Garu', 'సుబ్బుడు గారు', NULL),
('Ranga Garu [Rajolu]', 'రంగ గారు [రాజోలు]', NULL),
('Raju Garu [Box]', 'రాజు గారు [బాక్స్]', NULL),
('Lokesh Garu', 'లోకేష్ గారు', NULL),
('Satya Narayana Garu [Books]', 'సత్యనారాయణ గారు [బుక్స్]', NULL),
('Prasadh Garu [Jrg]', 'ప్రసాద్ గారు [జేఆర్‌జీ]', NULL),
('Krishna Garu [Nsp]', 'కృష్ణ గారు [ఎన్‌ఎస్‌పీ]', NULL)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 3. SEED DEFAULT SHOPS DIRECTORY
-- ============================================================================

-- Iron Shops
INSERT INTO public.shops (name, type, landmark, mobile) VALUES
('Srinu Sanchulu', 'Iron', 'By Pass Gate', '9848613450'),
('Venkatesh', 'Iron', 'Mentay Vari Thota', '6301954086'),
('Ramu', 'Iron', 'B.V.Raju Statue', '9492279929'),
('Vinay', 'Iron', 'D Mart', '9885411624'),
('Thota Ravi', 'Iron', 'DNR', '6302740077'),
('Chiranjeevi', 'Iron', 'Taderu', '9849280794'),
('Yedukodalu', 'Iron', 'Vissakoderu', '8123314166'),
('Markandeyulu', 'Iron', 'Palem Center', '9502414143'),
('Vepakayala Krishna', 'Iron', 'Undi Gate', '9848231657'),
('Reddy Garu', 'Iron', 'Undi Gate', '9989998638'),
('Koti Covers', 'Iron', 'Rayalam', '9542394942'),
('Satya Narayana', 'Iron', 'Rayalam', '9000561162'),
('Kiran Bhasha', 'Iron', 'Rayalam Road', '9290127748'),
('Dhanraj', 'Iron', 'Gollavanitippa', '9573288429'),
('Gollavanitippa Shop', 'Iron', 'Gollavanitippa', '9177774075'),
('Srinu DNR', 'Iron', 'Gollavanitippa Road', '9059111960'),
('Satya Narayana Pallepalem', 'Iron', 'Pallepalem', '9000163742'),
('Suribabu', 'Iron', 'Losari', '8187851344'),
('Bhimaraju', 'Iron', 'Dirusumarru', '9908305510'),
('Mahesh', 'Iron', 'Jakkaram', '9912244377'),
('Sugarcane Juice', 'Iron', 'Kalla', '8125621866'),
('Satish', 'Iron', 'Kalla', '7993704080'),
('Yallarao', 'Iron', 'Kalla', '9000547874'),
('Narendra', 'Iron', 'Juvvalapalem', '7013671991'),
('Shavukaru', 'Iron', 'Juvvalapalem', '9391512697'),
('Shankar', 'Iron', 'Juvvalapalem Road', '9603750559'),
('Subbarao', 'Iron', 'Kolamuru', '8106600669'),
('Naidu', 'Iron', 'Akividu', '9133544044'),
('Ravi Teja (Chinni)', 'Iron', 'Akividu', '7075660034'),
('Raju', 'Iron', 'Akividu', '9346303494'),
('Chanti', 'Iron', 'AMC, Akividu', '9652847199')
ON CONFLICT DO NOTHING;

-- Wine Shops
INSERT INTO public.shops (name, type, landmark, contact_person, mobile) VALUES
('Shiva Wines', 'Wine', 'Vissakoderu', 'Dundi Ashok', '9381491719'),
('GR Wines', 'Wine', 'Vissakoderu', 'Sri Ram', '9948938799'),
('Swapna Wines', 'Wine', 'Vissakoderu Bridge', 'Rajashekar', '9948278799'),
('Venkateswara Wines', 'Wine', 'Vissakoderu Bridge', 'P. Ramu', '9701155601'),
('Vijaya Sai Wines', 'Wine', 'Palem Centre', 'Vishnu', '9705018411'),
('Satya Krishna Wines', 'Wine', 'Wednesday Market', 'D.S.N', '9848567677'),
('VL Bar', 'Wine', 'Wednesday Market', 'Vara Lakshmi Bar', '9642247800'),
('Vijaya Beri Wines', 'Wine', 'B.V.Raju Statue', 'Srinu Pandu', '8125656899'),
('Satya Krishna Bar', 'Wine', 'Nirmala Back Side', 'D.S.N', '9848567677'),
('Gopi Krishna Bar', 'Wine', 'Town Station Road', 'Sai', '8247267697'),
('Vasu Raju Wines', 'Wine', 'Aadha Vantuna', 'V. Ramu', '9395592654'),
('Durga Wines', 'Wine', 'Aadha Vantuna', 'Sathish', '9440521343'),
('Suchitra Wines Padmalaya', 'Wine', 'Padmalaya', 'Shivaji', '8179147599'),
('Suchitra Wines Town Hall', 'Wine', 'Town Hall', 'Shivaji', '8179147599'),
('Suchitra Wines Fire Office', 'Wine', 'Fire Office', 'Shivaji', '8179147599'),
('SR Wines', 'Wine', 'Taderu', 'V. Bharath', '9704596677'),
('Friends Wines', 'Wine', 'Matyapur', 'Rambabu', '9704450210'),
('Rajesh Wines', 'Wine', 'Rayakuduru', 'Phani Varma', '9908068621'),
('MSR Wines', 'Wine', 'Nowduru', 'Naga Raju', '9849564236'),
('Vijaya Durga Wines', 'Wine', 'Palakoderu', 'Satish', '9440521343'),
('Durga Bar', 'Wine', 'Juvvalapalem Road', 'Satish', '9440521343'),
('Kasmora Club', 'Wine', 'Juvvalapalem Road', NULL, '9154493170'),
('Dikshitha Wines', 'Wine', 'Dirusumarru', 'Vasu', '9866937730')
ON CONFLICT DO NOTHING;

-- Akividu Wine Shops
INSERT INTO public.shops (name, type, landmark) VALUES
('Amrutha Bar', 'Akividu Wine', NULL),
('Amrutha Wines', 'Akividu Wine', NULL),
('Balaram Wines', 'Akividu Wine', NULL),
('Kick Wines', 'Akividu Wine', 'Dumpagadapa'),
('Anandh Wines', 'Akividu Wine', NULL),
('Jalsa Wines', 'Akividu Wine', NULL),
('Dubai Wines', 'Akividu Wine', NULL),
('Vinayaka Wines', 'Akividu Wine', NULL),
('Satya Wines', 'Akividu Wine', 'Siddapuram'),
('OG Wines', 'Akividu Wine', NULL),
('Sunandha Wines', 'Akividu Wine', NULL),
('Kunapa Reddy Wines', 'Akividu Wine', NULL),
('Lakshmi Wines', 'Akividu Wine', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. SEED DEFAULT EMPLOYEES / WORKERS
-- ============================================================================
INSERT INTO public.employees (name, name_te, gender, daily_wage, role, mobile, status) VALUES
('Rambabu', 'రాంబాబు', 'Gents', 500.00, 'Driver', '9876543210', 'Active'),
('Srinu', 'శ్రీను', 'Gents', 400.00, 'Helper', '9876543211', 'Active'),
('Prasad', 'ప్రసాద్', 'Gents', 450.00, 'Helper', '9876543212', 'Active'),
('Lokesh', 'లోకేష్', 'Gents', 450.00, 'Helper', '9876543213', 'Active')
ON CONFLICT DO NOTHING;
