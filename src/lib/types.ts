export type Deal = {
  id: string;
  productName: string;
  affiliateUrl: string;
  discountCode: string;
  discountPercent: number | null;
  domain: string;
  logoUrl: string;
  createdAt: string;
};

export type LogoHit = {
  name: string;
  domain: string;
  logoUrl: string;
};
