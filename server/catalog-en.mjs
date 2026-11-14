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
