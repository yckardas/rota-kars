// Katalogdaki metinlerin İngilizcesi (sitenin /en sürümü). Alan sırası catalog.mjs ile aynıdır.
export const en = {
  business: {
    whatsappLabel: "+90 545 935 34 10",
    hours: "Every day · until 10 pm",
  },
  features: [
    {
      title: "New tours every season",
      text: "Fresh routes to Kars, Van, Batumi and the Caucasus each season.",
    },
    {
      title: "Free cancellation",
      text: "Full refund up to 3 days before domestic tours and up to 5 days before tours abroad.",
    },
    {
      title: "Pay in Turkish lira",
      text: "All payments in TL, tours abroad included, so there is no exchange-rate risk.",
    },
    {
      title: "Happy guests",
      text: "Rated 4.9 from 456 reviews on Google.",
    },
  ],
  services: {
    "turizm-tasimaciligi": {
      title: "Tourist transport",
      imageAlt: "Tour coach with the Rota Kars Tur logo",
      text: "An experienced team that puts timing, comfort and safety first when transferring our guests from Turkey and abroad.",
    },
    "vip-transfer": {
      title: "VIP transfer",
      imageAlt: "Tour coach with the Rota Kars Tur logo",
      text: "Travel to any destination you choose in our custom-built, prestigious and comfortable VIP fleet, with trained staff.",
    },
    "kongre-toplanti": {
      title: "Conferences and meetings",
      imageAlt: "Tour coach with the Rota Kars Tur logo",
      text: "A punctual, reliable partner for transferring attendees of trade fairs, seminars and meetings.",
    },
    "express-tur": {
      title: "Express tour",
      imageAlt: "The cathedral and steppe at Ani",
      text: "Transport planned just for you, for trips, educational, cultural, arts and entertainment events.",
    },
  },
  fleet: {
    note: "Our vehicles are rented with a driver. Our drivers know the region well and are true professionals.",
    perks: [
      "D2 and B2 licensed",
      "Luxury and air-conditioned",
      "Microphone on board",
      "Refrigerator on board",
    ],
  },
  cancellationPolicy:
    "You can cancel an unpaid pre-booking free of charge at any time. For confirmed bookings, if you cancel up to 3 days before departure on domestic tours or 5 days before departure on international tours, the full amount you paid, including the deposit, is refunded. After that, the deposit is not refunded and anything paid above it is refunded; if you do not show up without notice, the amount paid is not refunded. If we cancel the tour, you get the full amount back or move to another date.",
  vehicle: {
    name: "VIP minibus",
    description:
      "18 passengers + 1 driver. The front seat next to the driver is reserved for the guide. 17 seats are open for booking.",
  },
  tours: {
    "ani-cildir": {
      name: "Ani, Çıldır and Kars",
      subtitle: "One day, thousands of years of stories.",
      category: "Culture",
      duration: "Day trip",
      season: "Winter route",
      summary:
        "A day that takes you from the stone monuments of Ani to the shores of Lake Çıldır, and from the streets of Kars to its local stories. Discover the region as your guide tells it.",
      included: [
        "Professional licensed guide",
        "Transport by VIP vehicle",
        "Agency escort",
      ],
      excluded: [
        "Museum and archaeological site entry fees",
        "Lunch and dinner",
        "Horse-drawn sleigh and Caucasian night",
      ],
      itinerary: [
        {
          time: "08:30",
          title: "Meet in Kars",
          text: "Departure from central Kars and meeting your guide.",
        },
        {
          time: "Morning",
          title: "In the footsteps of Ani",
          text: "The Museum of War History and the ancient city of Ani. Guided commentary and free time for photos.",
        },
        {
          time: "Midday",
          title: "On the shore of Lake Çıldır",
          text: "A walk around the lake and a meal stop at extra cost. The sleigh experience depends on suitable seasonal conditions.",
        },
        {
          time: "17:00",
          title: "Kars city tour",
          text: "Historic buildings and a panoramic city tour, after which the program ends.",
        },
      ],
      note: "The program may change depending on weather and road conditions. The ice and horse-drawn sleigh experience at Çıldır is not guaranteed.",
    },
    sarikamis: {
      name: "Sarıkamış Ski Tour",
      subtitle: "Winter's finest getaway.",
      category: "Winter",
      duration: "Day trip",
      end: "Evening",
      season: "Winter route",
      summary:
        "Spend the day on the ski slopes of Sarıkamış. This program from Kars brings together transport, ski equipment and lunch.",
      included: [
        "Ski clothing, skis and helmet",
        "Lunch",
        "Transport and travel insurance",
      ],
      excluded: [
        "Chairlift rides",
        "Gloves, hat and goggles",
        "Breakfast and dinner",
      ],
      itinerary: [
        {
          time: "08:30",
          title: "Departure from Kars",
          text: "The drive to Sarıkamış.",
        },
        {
          time: "Morning",
          title: "Gear up and ski",
          text: "Ski equipment handed out, then free time on the slopes.",
        },
        {
          time: "12:00",
          title: "Lunch break",
          text: "Lunch of sucuk (spiced sausage) sandwiches and ayran.",
        },
        {
          time: "Evening",
          title: "Back to Kars",
          text: "Equipment returned, then the drive back.",
        },
      ],
      note: "The program and slope conditions depend on the weather. Chairlift rides cost extra.",
    },
    batum: {
      name: "Batumi Day Trip",
      subtitle: "A new route across the border.",
      category: "Abroad",
      duration: "Day trip",
      end: "Night",
      season: "City route",
      summary:
        "On this journey from Kars to Batumi, explore the city's squares, seafront and landmarks with a local guide.",
      included: [
        "Breakfast",
        "Professional guiding and transport",
        "Refreshments on board and travel insurance",
      ],
      excluded: [
        "Lunch and dinner",
        "Museum entry fees and cable car",
        "Departure tax for leaving Turkey",
      ],
      itinerary: [
        {
          time: "00:00",
          title: "Departure from Kars",
          text: "The drive via Ardahan and Artvin.",
        },
        {
          time: "07:00",
          title: "Breakfast in Hopa",
          text: "Breakfast and border crossing formalities.",
        },
        {
          time: "All day",
          title: "Exploring Batumi",
          text: "Gonio Fortress, the seafront, the squares and the city's landmarks.",
        },
        {
          time: "16:00",
          title: "The journey back",
          text: "Departure for the border gate. Times may vary with how busy it is.",
        },
      ],
      note: "Entry documents, border conditions and current fees are confirmed by the agency before travel.",
    },
    "van-gunubirlik": {
      name: "Van Day Trip",
      subtitle: "From the waterfall to Akdamar, Van in a single day.",
      category: "Culture",
      duration: "Day trip",
      end: "Night",
      season: "Summer route",
      summary:
        "A full day that runs from the Tendürek Pass to Muradiye Waterfall, and from the famous Van breakfast to Akdamar Island and Van Fortress.",
      included: [
        "Breakfast",
        "Transport and professional guiding",
        "Refreshments on board and travel insurance",
      ],
      excluded: [
        "Lunch and dinner",
        "Van Fortress, museum and archaeological site entry fees",
        "Boat fare to Akdamar Island",
      ],
      itinerary: [
        {
          time: "03:00",
          title: "Departure from Kars",
          text: "The drive over the Tendürek Pass (2,644 m) and across the Çaldıran Plain.",
        },
        {
          time: "Morning",
          title: "Muradiye Waterfall and Van breakfast",
          text: "Free time at the waterfall, followed by the famous Van breakfast.",
        },
        {
          time: "Midday",
          title: "Silver Workshop, Cat House, Akdamar",
          text: "Urartian silver craft, Van cats, and a boat ride to the Church of the Holy Cross on Akdamar Island.",
        },
        {
          time: "Late afternoon",
          title: "Van Museum and Van Fortress",
          text: "Traces of the Urartian civilization, Tushpa, and lake views at sunset. Then the drive back.",
        },
      ],
      note: "The program may change depending on weather and road conditions.",
    },
    van: {
      name: "Van Tour with Overnight Stay",
      subtitle: "Including the Salt Cave and İshak Paşa Palace.",
      category: "Overnight",
      duration: "2 days · 1 night",
      end: "Day 2, evening",
      season: "Overnight route",
      summary:
        "A two-day program that begins with the Tuzluca Salt Cave and İshak Paşa Palace and ends with Muradiye, Akdamar and Van Fortress.",
      included: [
        "2 breakfasts and 1 night's accommodation",
        "Transport, professional guiding and agency escort",
        "Refreshments on board and travel insurance",
      ],
      excluded: [
        "Lunch and dinner",
        "Van Fortress, museum and archaeological site entry fees",
        "Boat fare to Akdamar Island",
      ],
      itinerary: [
        {
          time: "Day 1, 07:00",
          title: "Salt Cave and İshak Paşa Palace",
          text: "Departure toward Iğdır, the Tuzluca Salt Cave, and İshak Paşa Palace in Doğubayazıt.",
        },
        {
          time: "Day 1, afternoon",
          title: "Muradiye, Silver Workshop, Cat House",
          text: "The Tendürek Pass, Muradiye Waterfall, and check-in at the hotel in Van.",
        },
        {
          time: "Day 2",
          title: "Akdamar and Van Fortress",
          text: "Breakfast at the hotel, a boat ride to Akdamar Island, Van Museum and Van Fortress. Then the drive back to Kars.",
        },
      ],
      note: "The hotel and final program are confirmed by the agency before the tour date.",
    },
    "van-havzasi": {
      name: "Lake Van Basin Tour",
      subtitle: "Three days, from Nemrut Crater Lake to Ahlat.",
      category: "Overnight",
      duration: "3 days · 2 nights",
      departure: "Set by the agency",
      end: "Day 3, evening",
      season: "Overnight route",
      summary:
        "A wide-ranging program covering the Salt Cave, İshak Paşa Palace, Muradiye, Akdamar, Van Fortress, the Seljuk Cemetery of Ahlat, Nemrut Crater Lake, Bitlis and Tatvan.",
      included: [
        "3 breakfasts",
        "2 nights' accommodation (Tatvan – Van)",
        "Transport, guiding, agency escort and travel insurance",
      ],
      excluded: [
        "Lunch and dinner",
        "Museum and archaeological site entry fees",
        "Boat fare to Akdamar Island",
      ],
      itinerary: [],
      note: "Contact us for current dates and availability.",
    },
    tiflis: {
      name: "Tbilisi Tour",
      subtitle: "Three days in the capital of the Caucasus.",
      category: "Abroad",
      duration: "3 days · 2 nights",
      departure: "05:00",
      end: "Day 3, evening",
      season: "Route abroad",
      summary:
        "A three-day trip from Kars to Tbilisi via the Çıldır–Aktaş border crossing: the narrow streets of the old town, Narikala Fortress, the sulphur baths and Mtskheta, with a guide.",
      included: [
        "2 nights' hotel accommodation (breakfast included)",
        "Transport, professional guiding and agency escort",
        "On-board refreshments and travel insurance",
      ],
      excluded: [
        "Lunch and dinner",
        "Museum, fortress and cable car tickets",
        "Sulphur bath and personal expenses",
      ],
      itinerary: [
        { time: "Day 1 · 05:00", title: "Departure from Kars", text: "Via Çıldır to the Aktaş border crossing, then on through Georgia." },
        {
          time: "Day 1 · afternoon",
          title: "Old Tbilisi",
          text: "Hotel check-in, then an evening walk around Narikala Fortress, the Abanotubani sulphur baths and Metekhi Church.",
        },
        {
          time: "Day 2",
          title: "Tbilisi and Mtskheta",
          text: "Sameba Cathedral, Rustaveli Avenue and the Bridge of Peace, followed by UNESCO-listed Mtskheta and Jvari Monastery.",
        },
        { time: "Day 3", title: "Free time and return", text: "Free time at the Dry Bridge market, then the drive back to Kars in the afternoon." },
      ],
      note: "The tour goes ahead once there is enough demand. Entry documents (passport or new-type ID card) and border conditions are confirmed by the agency before travel.",
    },
    "butik-mardin": {
      name: "Boutique Mardin Tour",
      subtitle: "Diyarbakır, Mardin and Midyat: on the trail of stone and time.",
      category: "Overnight",
      duration: "2 days · 1 night",
      departure: "Evening",
      end: "Day 2, at night",
      season: "Overnight route",
      summary:
        "A boutique route from the city walls of Diyarbakır and the Ten-Arched Bridge to the vaulted stone lanes of Mardin, Deyrulzafaran Monastery and the mansions of Midyat. Hasan Pasha Inn, the Great Mosque, the Four-Legged Minaret, Kasımiye Madrasa, Old Mardin, the Sıla Mansion and Beyaz Su are all on the way.",
      included: [
        "1 night's accommodation and 2 breakfasts",
        "Professional guiding and agency escort",
        "Transport by luxury vehicle and refreshments on board",
        "Travel insurance",
      ],
      excluded: [
        "Museum and archaeological site entry fees",
        "Lunch and dinner",
        "Mardin Turkish night",
        "Personal expenses",
      ],
      itinerary: [
        {
          time: "Departure · evening",
          title: "From Kars to Diyarbakır",
          text: "Departure from Kars in the evening, an overnight drive and arrival in Diyarbakır in the morning.",
        },
        {
          time: "Day 1 · morning",
          title: "Diyarbakır city tour",
          text: "Breakfast in a Diyarbakır mansion, then the historic city walls, the Great Mosque, the Four-Legged Minaret, Mardin Gate, Hevsel Gardens and the Ten-Arched Bridge.",
        },
        {
          time: "Day 1 · afternoon",
          title: "Old Mardin",
          text: "Arrival in Mardin. The Great Mosque in the historic centre, a walk through lanes that pass under vaulted abbara passages, and free time for shopping. Overnight in Mardin (Yay Grand Hotel, Bilen, Falaylar or similar).",
        },
        {
          time: "Day 2 · morning",
          title: "Kasımiye and Deyrulzafaran",
          text: "From the hotel to Kasımiye Madrasa and Deyrulzafaran Monastery, followed by free time for shopping.",
        },
        {
          time: "Day 2 · midday",
          title: "Beyaz Su",
          text: "A lunch stop (at extra cost) at the riverside restaurants of Beyaz Su, known for its scenery.",
        },
        {
          time: "Day 2 · afternoon",
          title: "Midyat",
          text: "The mansion made famous by the TV series Sıla and free time in the silversmiths' bazaar. Then the drive back to Kars, arriving at night.",
        },
      ],
      note: "Our guide and organiser may change the program depending on weather and climate conditions in the region. Seat numbers are assigned in order of booking. If the tour does not reach enough participants, the agency may cancel it with notice no later than 48 hours before departure.",
    },
    guneydogu: {
      name: "Southeastern Anatolia Tour",
      subtitle: "Diyarbakır, Şanlıurfa, Gaziantep and Mardin in four days.",
      category: "Overnight",
      duration: "4 days · 3 nights",
      end: "03:00, the night after day 4",
      season: "Overnight route",
      summary:
        "A wide-ranging Southeast program designed for public holidays and long weekends: the walls of Diyarbakır, Balıklıgöl, Göbeklitepe, the beehive houses of Harran, Halfeti, the Zeugma Mosaic Museum, Gaziantep Castle, Mardin and Midyat on a single route.",
      included: [
        "3 nights' accommodation and 4 breakfasts",
        "4 days of professional guiding and agency escort",
        "Transport by luxury vehicle and refreshments on board",
        "Travel insurance",
      ],
      excluded: [
        "Museum and archaeological site entry fees",
        "Lunch and dinner",
        "Halfeti boat trip",
        "Urfa sıra gecesi (traditional music night)",
        "Personal expenses",
      ],
      itinerary: [
        {
          time: "Departure · 22:00",
          title: "Setting off from Kars",
          text: "Departure from Kars in the evening and an overnight drive.",
        },
        {
          time: "Diyarbakır",
          title: "City walls and historic centre",
          text: "Hasan Pasha Inn, the historic city walls, the Great Mosque, the Cahit Sıtkı Tarancı House, the Four-Legged Minaret and the Ten-Arched Bridge.",
        },
        {
          time: "Şanlıurfa",
          title: "Balıklıgöl, Göbeklitepe and Harran",
          text: "Balıklıgöl, Göbeklitepe and the houses of Harran. In the evening, an optional sıra gecesi (at extra cost).",
        },
        {
          time: "Gaziantep · Halfeti",
          title: "Zeugma and the Euphrates",
          text: "Halfeti (boat trip at extra cost), the Zeugma Mosaic Museum, the Hamam Museum, the Culinary Museum, Gaziantep Castle and the Coppersmiths' Bazaar.",
        },
        {
          time: "Mardin · Midyat",
          title: "Cities of stone",
          text: "Deyrulzafaran Monastery, Kasımiye Madrasa, Old Mardin and the Sıla Mansion in Midyat.",
        },
        {
          time: "Return · 03:00",
          title: "Arrival in Kars",
          text: "Arrival in Kars at around 03:00 on the night after the last day.",
        },
      ],
      note: "The price is an estimate based on the most recent holiday program; current dates and prices are announced once the tour is confirmed. The order of visits by day is set by our guide according to road and weather conditions.",
    },
    nahcivan: {
      name: "Nakhchivan Day Trip",
      subtitle: "Across the border in a day: the land of Noah.",
      category: "Abroad",
      duration: "Day trip",
      end: "Night",
      season: "Route abroad",
      summary:
        "Leave Kars early in the morning and see Nakhchivan in a day: the Momine Khatun Mausoleum, Noah's Tomb, Nakhchivan Fortress, the Khan's Palace, Flag Square, the Open-Air Museum, the Heydar Aliyev Museum, the Heydar Mosque and the Salt Cave.",
      included: [
        "Breakfast",
        "Transport by luxury vehicle",
        "Guiding and agency escort",
        "Travel insurance",
      ],
      excluded: [
        "Departure tax for leaving Turkey (1,250 TL)",
        "Lunch and dinner",
        "Personal expenses",
      ],
      itinerary: [
        {
          time: "05:00",
          title: "Departure from Kars",
          text: "The drive via Iğdır to the border gate, breakfast and border crossing formalities.",
        },
        {
          time: "All day",
          title: "Nakhchivan city tour",
          text: "The Heydar Aliyev Museum, the Momine Khatun Mausoleum (panoramic), Nakhchivan Fortress, the Khan's Palace, Flag Square and the Open-Air Museum.",
        },
        {
          time: "During the day",
          title: "Noah's Tomb and the Salt Cave",
          text: "Noah's Tomb, the Heydar Mosque and the Salt Cave.",
        },
        {
          time: "17:00",
          title: "Return from Nakhchivan",
          text: "Departure for the border gate and the drive back to Kars. Times may vary with how busy the border is.",
        },
      ],
      note: "Entry is with the new-type Turkish ID card. The ID cards of travellers under 18 must carry a photo; under-18s not travelling with their mother or father need a notarised letter of consent. A departure tax of 1,250 TL per person is paid at the border.",
    },
    "sivas-kemaliye": {
      name: "Sivas, Divriği and Kemaliye Tour",
      subtitle: "From Seljuk stonework to the Dark Canyon.",
      category: "Overnight",
      duration: "2 days · 1 night",
      end: "Day 2, 23:50",
      season: "Summer route",
      summary:
        "The Seljuk madrasas of Sivas, the UNESCO-listed Great Mosque of Divriği, and Kemaliye with its Dark Canyon carved by the Euphrates. Three different worlds in two days.",
      included: [
        "1 night's hotel accommodation and 2 breakfasts",
        "1 dinner at the hotel",
        "2 days of professional guiding and agency escort",
        "Refreshments on board",
        "Travel and health insurance",
      ],
      excluded: [
        "Museum and archaeological site entry fees",
        "Lunches and dinner on the last day",
        "Dark Canyon jeep safari and boat trip",
        "Personal expenses",
      ],
      itinerary: [
        {
          time: "Departure · 22:00",
          title: "Setting off from Kars",
          text: "Departure from Kars in the evening and an overnight drive.",
        },
        {
          time: "Sivas",
          title: "Madrasas and the Congress Building",
          text: "Gök Madrasa, the Congress Building, the Twin Minaret Madrasa, the Şifaiye hospital-madrasa and Buruciye Madrasa.",
        },
        {
          time: "Divriği",
          title: "The Great Mosque and the glass terrace",
          text: "The Great Mosque of Divriği, the Nuri Demirağ Museum and the glass viewing terrace.",
        },
        {
          time: "Kemaliye",
          title: "The Dark Canyon and Apçağa",
          text: "The Dark Canyon (jeep safari and boat trip at extra cost), the Mani Road, Apçağa village, the Lökhane and the Ahmet Kutsi Tecer Culture House.",
        },
        {
          time: "Return · 23:50",
          title: "Arrival in Kars",
          text: "Arrival in Kars late on the second day.",
        },
      ],
      note: "The jeep safari and boat trip are optional and paid for on site. The hotel and final program are confirmed by the agency before the tour date.",
    },
    karadeniz: {
      name: "Black Sea Tour",
      subtitle: "Every shade of green, from Uzungöl to Ayder.",
      category: "Overnight",
      duration: "2 days · 1 night",
      departure: "Set by the agency",
      end: "Day 2",
      season: "Summer route",
      summary:
        "Hagia Sophia and the Atatürk Pavilion in Trabzon, Uzungöl in the mist, the tea gardens of Rize, the stone bridges of the Fırtına Valley and the Ayder Plateau. The best-loved stops of the eastern Black Sea in one program.",
      included: [
        "1 night's hotel accommodation and 2 breakfasts",
        "Professional guiding and agency escort",
        "Ayder Plateau entry fee",
        "Refreshments on board",
        "Travel insurance",
      ],
      excluded: [
        "Museum and archaeological site entry fees",
        "Lunch and dinner",
        "Zipline and rafting activities",
        "Personal expenses",
      ],
      itinerary: [
        {
          time: "Trabzon",
          title: "Hagia Sophia and the Atatürk Pavilion",
          text: "The Hagia Sophia Museum, Trabzon Square and the Atatürk Pavilion.",
        },
        {
          time: "Uzungöl",
          title: "A stop by the lake",
          text: "A walk and free time at Uzungöl.",
        },
        {
          time: "Rize",
          title: "The home of tea",
          text: "A tea factory, Rize Castle and Rize cloth.",
        },
        {
          time: "Ayder",
          title: "The Fırtına Valley and the plateau",
          text: "The Fırtına Valley and the Ayder Plateau. Optional zipline and rafting (at extra cost).",
        },
        {
          time: "Along the way",
          title: "Other stops",
          text: "A knife-making workshop and the Sevdaluk Bridge.",
        },
      ],
      note: "The departure time and the order of visits by day are confirmed by the agency before the tour date. The program may change depending on weather and road conditions.",
    },
    "narman-tortum": {
      name: "Narman Fairy Chimneys and Tortum Waterfall",
      subtitle: "A day in the land of the red fairies.",
      category: "Nature",
      duration: "Day trip",
      season: "Nature route",
      summary:
        "The red fairy chimneys of Narman, Oltu Castle and the Oltu Rainbow Hills, followed by Tortum Waterfall, the Seven Lakes and the glass viewing terrace. The natural wonders of Erzurum on a one-day route.",
      included: [
        "Transport by luxury vehicle",
        "Agency escort",
        "Refreshments on board",
        "Travel insurance",
      ],
      excluded: ["All meals", "Activities", "Personal expenses"],
      itinerary: [
        {
          time: "08:00",
          title: "Departure from Kars",
          text: "Setting off from central Kars.",
        },
        {
          time: "Narman",
          title: "The land of the red fairies",
          text: "A walk and photo stop at the Narman Fairy Chimneys.",
        },
        {
          time: "Oltu",
          title: "The castle and the Rainbow Hills",
          text: "Oltu Castle and the Oltu Rainbow Hills.",
        },
        {
          time: "Tortum",
          title: "The waterfall and the Seven Lakes",
          text: "Tortum Waterfall, the Seven Lakes and the glass viewing terrace.",
        },
        {
          time: "20:30",
          title: "Back in Kars",
          text: "The tour ends in Kars.",
        },
      ],
      note: "The program may change depending on weather and road conditions. Meals and activities are not included in the tour price.",
    },
    "savsat-karagol": {
      name: "Şavşat Karagöl Tour",
      subtitle: "A lake hidden in the forest.",
      category: "Nature",
      duration: "Day trip",
      end: "Evening",
      season: "Nature route",
      summary:
        "A deep-green day that runs from Susuz Waterfall to the viewpoints of Şavşat, and from the wooden Şavşat houses and the Kocaköy highlands to Karagöl, a lake in the middle of spruce forest.",
      included: [
        "Transport by luxury vehicle",
        "Agency escort",
        "Refreshments on board",
        "Karagöl entry fee",
      ],
      excluded: [
        "Breakfast, lunch and dinner",
        "Rowing boat on Karagöl",
        "Personal expenses",
      ],
      itinerary: [
        {
          time: "08:30",
          title: "Departure from Kars",
          text: "A stop at Susuz Waterfall on the way.",
        },
        {
          time: "Late morning",
          title: "Views of Şavşat",
          text: "Şavşat Viewpoint, the Yavuzköy viewing terrace, the Şavşat houses and the Kocaköy highlands.",
        },
        {
          time: "Afternoon",
          title: "Şavşat Karagöl",
          text: "A walk around the lake and free time. Optional rowing boat (at extra cost).",
        },
        {
          time: "16:00",
          title: "Leaving Karagöl",
          text: "The drive back to Kars.",
        },
      ],
      note: "The program may change depending on weather and road conditions. Meals are not included in the tour price.",
    },
    "buyuk-azerbaycan": {
      name: "Grand Azerbaijan Tour",
      subtitle: "Three days from Nakhchivan to Baku, flights included.",
      category: "Abroad",
      duration: "3 days · 2 nights",
      departure: "Set by the agency",
      end: "Day 3",
      season: "Route abroad",
      summary:
        "A wide-ranging Azerbaijan program in which we tour Nakhchivan and fly on to Baku: the Old City (Icherisheher), the Maiden Tower, the Palace of the Shirvanshahs, the Flame Towers, the Heydar Aliyev Center, Gobustan and the mud volcanoes, returning via Nakhchivan.",
      included: [
        "2 nights' hotel accommodation in Baku and 3 breakfasts",
        "Nakhchivan – Baku – Nakhchivan flights",
        "3 days of guiding and agency escort",
        "Transport by luxury vehicle and refreshments on board",
        "International travel and health insurance",
      ],
      excluded: [
        "Departure tax for leaving Turkey (1,250 TL)",
        "Museum and archaeological site entry fees",
        "Lunch and dinner",
        "Optional activities",
        "Personal expenses",
      ],
      itinerary: [
        {
          time: "Nakhchivan",
          title: "Nakhchivan city tour",
          text: "The Heydar Aliyev Museum, the Momine Khatun Mausoleum (panoramic), Noah's Tomb, Nakhchivan Fortress, the Khan's Palace, Flag Square, the Open-Air Museum and the Heydar Mosque.",
        },
        {
          time: "Baku · old city",
          title: "Icherisheher and the Maiden Tower",
          text: "Icherisheher, the Maiden Tower, the Palace of the Shirvanshahs, the Museum of Miniature Books, the National Carpet Museum, Little Venice and Nizami Street.",
        },
        {
          time: "Baku · the city",
          title: "Highland Park and the Flame Towers",
          text: "The funicular, Highland Park, Martyrs' Lane, the Baku Turkish Martyrs' Memorial, the Alley of Honour, the Flame Towers, the Heydar Aliyev Center and Deniz Mall.",
        },
        {
          time: "Gobustan",
          title: "Rock art and mud volcanoes",
          text: "Gobustan National Park, the mud volcanoes and the Bibi-Heybat Mosque.",
        },
      ],
      note: "Entry is with the new-type Turkish ID card. The ID cards of travellers under 18 (infants included) must carry a photo; under-18s not travelling with their mother or father need a notarised letter of consent. A departure tax of 1,250 TL per person is paid at the border. Flight times and the order of visits by day are confirmed before the tour date.",
    },
  },
  stories: {
    ani: {
      title: "The quiet story of Ani",
      location: "Ancient City of Ani",
      scenes: [
        {
          title: "A city told by its stones",
          text: "Trace the past among the monuments of Ani as your guide tells their story.",
        },
        {
          title: "Ani through your own eyes",
          text: "A pause during free time to photograph the architecture and the views.",
        },
        {
          title: "Further along the route",
          text: "Lake Çıldır and a Kars city tour also await you on the same program.",
        },
      ],
    },
    cildir: {
      title: "Çıldır's winter tale",
      location: "Lake Çıldır",
      scenes: [
        {
          title: "A day by the lake",
          text: "Wide white winter views, clean air and a stop on the lakeshore.",
        },
        {
          title: "As far as the season allows",
          text: "Ice and horse-drawn sleigh experiences depend on the weather. The sleigh is not included in the tour price.",
        },
        {
          title: "A route that leads to the table",
          text: "Slow the day down with a lakeside lunch stop at extra cost.",
        },
      ],
    },
    sarikamis: {
      title: "Winter time in Sarıkamış",
      location: "Sarıkamış",
      scenes: [
        {
          title: "Chasing snow for a day",
          text: "A trip from Kars to the Sarıkamış ski resort.",
        },
        {
          title: "Equipment included",
          text: "Skis, clothing and helmet are included. Bring your own hat, gloves and goggles.",
        },
        {
          title: "A full winter day",
          text: "Transport and lunch are included; chairlift rides cost extra.",
        },
      ],
    },
  },
};
