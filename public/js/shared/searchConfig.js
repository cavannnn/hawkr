
import { setSearchNavigation, setSearchDestinationResolver, setSearchScope, setSearchProvider } from "./searchModule.js";

const ICONS = "../../assets/icons/";
export function configureVendorSearch() {
  setSearchNavigation([
    { id: "nav-orders",   name: "Orders",   keywords: "orders incoming queue",        icon: ICONS + "orders.svg",   color: "#F6EEF9", url: "/vendor/Order/vendorOrder.html" },
    { id: "nav-menu",     name: "Menu",     keywords: "menu items dishes prices",     icon: ICONS + "menu.svg",     color: "#F2F2FF", url: "/vendor/Menu/vendorMenu.html" },
    { id: "nav-payments", name: "Payments", keywords: "payments payouts refunds",     icon: ICONS + "payments.svg", color: "#EAF5E9", url: "/vendor/Payments/vendorPayments.html" },
    { id: "nav-reviews",  name: "Reviews",  keywords: "reviews feedback ratings",     icon: ICONS + "feedback.svg", color: "#F2F5FC", url: "/vendor/Reviews/vendorReviews.html" },
    { id: "nav-tenancy",  name: "Tenancy",  keywords: "tenancy rent lease agreement", icon: ICONS + "tenancy.svg",  color: "#F6EEF9", url: "/vendor/Tenancy/vendorTenancy.html" },
    { id: "nav-support",  name: "Support",  keywords: "support ticket help issue problem report faulty", icon: ICONS + "feedback.svg", color: "#F2F5FC", url: "/vendor/Support/vendorSupport.html" },
    { id: "nav-promotions", name: "Promotions", keywords: "promotions promos discounts deals offers vouchers campaign", icon: ICONS + "vouchers.svg",  color: "#F6EEF9", url: "/vendor/Promotions/vendorPromotions.html" },
    { id: "nav-stock",      name: "Inventory",  keywords: "inventory stock ingredients supplies low stock reorder count", icon: ICONS + "clipboard.svg", color: "#EAF5E9", url: "/vendor/Stock/vendorStock.html" },
    { id: "nav-settings", name: "Settings", keywords: "settings account profile",     icon: ICONS + "settings.svg", color: "#F2F2FF", url: "/vendor/Settings/vendorSettings.html" },
    
    { id: "nav-stalls",   name: "Your stall",        keywords: "stall store outlet my stall hub details orders rent",             icon: ICONS + "vendor.svg", color: "#EAF5E9", url: "/vendor/Stall/vendorStallDetail.html" },
    { id: "nav-apply",    name: "Apply for a stall", keywords: "apply new stall another stall open a stall request hawker centre", icon: ICONS + "add.svg",    color: "#F6EEF9", url: "/vendor/Stall/vendorStallApply.html" },
  ]);

  
  setSearchProvider(async (query) => {
    const { searchVendor } = await import("../../data/vendorData.js");
    return searchVendor(query);
  });

  
  setSearchDestinationResolver(({ type, id, stallId }) => {
    if (type === "menuItem") return `/vendor/Menu/vendorMenu.html?item=${id}`;
    if (type === "stall") return `/vendor/Menu/vendorMenu.html?stall=${id}`;
    return null; 
  });
}

export function configureOperatorSearch() {
  setSearchNavigation([
    { id: "nav-children",     name: "My Stalls",  keywords: "stalls vendors children tenants", icon: ICONS + "vendor.svg",       color: "#F2F2FF", url: "/operator/Children/operatorChildren.html" },
    { id: "nav-transactions", name: "Transactions", keywords: "rent payments transactions",      icon: ICONS + "payments.svg",     color: "#EAF5E9", url: "/operator/Transactions/operatorTransactions.html" },
    { id: "nav-notifications",name: "Notifications",keywords: "notifications alerts updates",    icon: ICONS + "notifications.svg",color: "#F2F5FC", url: "/operator/Notifications/operatorNotifications.html" },
    { id: "nav-requests",        name: "Stall requests",    keywords: "stall requests applications application apply pending approve reject decision new vendor unit", icon: ICONS + "clipboard.svg",    color: "#F6EEF9", url: "/operator/Requests/operatorRequests.html" },
    { id: "nav-rentals",         name: "Rental agreements", keywords: "rental rentals agreement agreements lease contract tenancy rent stall",                        icon: ICONS + "agreement.svg",    color: "#F2F2FF", url: "/operator/Rentals/operatorRentals.html" },
    { id: "nav-renewals",        name: "Rental renewals",   keywords: "renewals renewal renew expiring expiry expire extend lease due ending",                        icon: ICONS + "tenancy.svg",      color: "#F2F2FF", url: "/operator/Rentals/operatorRenewals.html" },
    { id: "nav-rental-history",  name: "Agreement history", keywords: "agreement history past previous ended expired terminated archive old rentals",                 icon: ICONS + "history.svg",      color: "#F2F2FF", url: "/operator/Rentals/operatorRentalHistory.html" },
    { id: "nav-support",         name: "Support",           keywords: "support tickets ticket help issue problem complaint report faulty inbox queue",                icon: ICONS + "feedback.svg",     color: "#F2F5FC", url: "/operator/Support/operatorSupport.html" },
    { id: "nav-support-history", name: "Past tickets",      keywords: "past tickets resolved closed answered support history archive",                                icon: ICONS + "history.svg",      color: "#F2F5FC", url: "/operator/Support/operatorSupportHistory.html" },
    { id: "nav-centres",         name: "Centre management", keywords: "centre centres center centers hawker centre management closures closed promotions operations satisfaction units facilities", icon: ICONS + "organisation.svg", color: "#EAF5E9", url: "/operator/Centres/operatorCentres.html" },
  ]);

  setSearchDestinationResolver(({ type, id, stallId }) => {
    if (type === "stall") return `/operator/Children%20Detail/operatorChildrenDetail.html?id=${id}`;
    if (type === "menuItem" && stallId) return `/operator/Children%20Detail/operatorChildrenDetail.html?id=${stallId}`;
    return null;
  });
}

export function configureOperatorChildrenSearch({ hawkerCentreId } = {}) {
  configureOperatorSearch();
  setSearchScope(hawkerCentreId != null ? { hawkerCentreId } : null);
}
