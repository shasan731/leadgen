export type OsmTag = {
  key: string;
  value: string;
};

export type OsmCategory = {
  key: string;
  label: string;
  tags: OsmTag[];
};

export const OSM_CATEGORIES = {
  restaurant: {
    key: "restaurant",
    label: "Restaurant",
    tags: [{ key: "amenity", value: "restaurant" }]
  },
  cafe: {
    key: "cafe",
    label: "Cafe",
    tags: [{ key: "amenity", value: "cafe" }]
  },
  pharmacy: {
    key: "pharmacy",
    label: "Pharmacy",
    tags: [
      { key: "amenity", value: "pharmacy" },
      { key: "shop", value: "chemist" }
    ]
  },
  clinic: {
    key: "clinic",
    label: "Clinic",
    tags: [
      { key: "amenity", value: "clinic" },
      { key: "amenity", value: "doctors" }
    ]
  },
  dentist: {
    key: "dentist",
    label: "Dentist",
    tags: [{ key: "amenity", value: "dentist" }]
  },
  school: {
    key: "school",
    label: "School",
    tags: [{ key: "amenity", value: "school" }]
  },
  gym: {
    key: "gym",
    label: "Gym",
    tags: [{ key: "leisure", value: "fitness_centre" }]
  },
  hotel: {
    key: "hotel",
    label: "Hotel",
    tags: [
      { key: "tourism", value: "hotel" },
      { key: "tourism", value: "guest_house" }
    ]
  },
  beauty_salon: {
    key: "beauty_salon",
    label: "Beauty salon",
    tags: [
      { key: "shop", value: "beauty" },
      { key: "shop", value: "hairdresser" }
    ]
  },
  car_repair: {
    key: "car_repair",
    label: "Car repair",
    tags: [{ key: "shop", value: "car_repair" }]
  },
  real_estate: {
    key: "real_estate",
    label: "Real estate",
    tags: [{ key: "office", value: "estate_agent" }]
  },
  lawyer: {
    key: "lawyer",
    label: "Lawyer",
    tags: [{ key: "office", value: "lawyer" }]
  },
  travel_agency: {
    key: "travel_agency",
    label: "Travel agency",
    tags: [
      { key: "shop", value: "travel_agency" },
      { key: "office", value: "travel_agent" }
    ]
  },
  computer_shop: {
    key: "computer_shop",
    label: "Computer or electronics shop",
    tags: [
      { key: "shop", value: "computer" },
      { key: "shop", value: "electronics" }
    ]
  },
  supermarket: {
    key: "supermarket",
    label: "Supermarket or convenience",
    tags: [
      { key: "shop", value: "supermarket" },
      { key: "shop", value: "convenience" }
    ]
  },
  isp_or_telecom: {
    key: "isp_or_telecom",
    label: "ISP or telecom",
    tags: [
      { key: "office", value: "telecommunication" },
      { key: "telecom", value: "*" }
    ]
  }
} satisfies Record<string, OsmCategory>;

export type OsmCategoryKey = keyof typeof OSM_CATEGORIES;

export const OSM_CATEGORY_KEYS = Object.keys(OSM_CATEGORIES) as Array<keyof typeof OSM_CATEGORIES>;
