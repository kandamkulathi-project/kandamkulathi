// Synthetic DTO fixtures only; no permission evidence or runtime data fallback.
export const staffCommerceIds = {
  clinic: "aaaaaaaa-0000-4000-8000-000000000101",
  location: "ffffffff-0000-4000-8000-000000000601",
  otherLocation: "ffffffff-0000-4000-8000-000000000602",
  order: "bbbbbbbb-0000-4000-8000-000000000201",
  batch: "cccccccc-0000-4000-8000-000000000301",
  sku: "dddddddd-0000-4000-8000-000000000401",
  next: "eeeeeeee-0000-4000-8000-000000000501",
} as const;
export const staffCommerceAssociation = {
  clinicId: staffCommerceIds.clinic,
  locationId: staffCommerceIds.location,
  clinicName: "Synthetic directory clinic A",
};
export const staffCommerceOrderPage = {
  items: [
    {
      orderId: staffCommerceIds.order,
      locationId: staffCommerceIds.location,
      amountPaise: 12500,
      currency: "INR",
      status: "reserved",
      version: 3,
      source: "phone",
      createdAt: "2026-10-24T10:00:00.000Z",
      expiresAt: "2026-10-24T10:15:00.000Z",
    },
  ],
  nextCursor: staffCommerceIds.next,
};
export const staffCommerceBatchPage = {
  items: [
    {
      batchId: staffCommerceIds.batch,
      skuId: staffCommerceIds.sku,
      locationId: staffCommerceIds.location,
      batchCode: "Synthetic batch A",
      expiresOn: "2027-10-24",
      onHand: 8,
      reserved: 3,
      recalled: true,
    },
  ],
  nextCursor: null,
};
