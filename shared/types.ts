/** Shared deal shapes used by the admin UI and Netlify functions. */

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

export type SiteSettings = {
  title: string;
  logoUrl: string;
};

export type DealInput = {
  productName: string;
  affiliateUrl: string;
  discountCode: string;
  discountPercent: number | null;
  logoUrl?: string;
  domain?: string;
};
