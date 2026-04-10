import { useCallback } from 'react'
import { useClient } from '../contexts/ClientContext'
import * as data from '../utils/data'

export function useClientData() {
  const { clientId } = useClient()

  return {
    getSales: useCallback(() => data.getSales(clientId), [clientId]),
    addSale: useCallback((sale) => data.addSale(sale, clientId), [clientId]),
    addSales: useCallback((sales) => data.addSales(sales, clientId), [clientId]),
    updateSale: useCallback((id, updates) => data.updateSale(id, updates, clientId), [clientId]),
    deleteSale: useCallback((id) => data.deleteSale(id, clientId), [clientId]),
    getSalesWithNetCash: useCallback(() => data.getSalesWithNetCash(clientId), [clientId]),

    getReports: useCallback(() => data.getReports(clientId), [clientId]),
    addReport: useCallback((report) => data.addReport(report, clientId), [clientId]),
    addReports: useCallback((reports) => data.addReports(reports, clientId), [clientId]),
    updateReport: useCallback((id, updates) => data.updateReport(id, updates, clientId), [clientId]),
    deleteReport: useCallback((id) => data.deleteReport(id, clientId), [clientId]),

    getTeam: useCallback(() => data.getTeam(clientId), [clientId]),
    addMember: useCallback((member) => data.addMember(member, clientId), [clientId]),
    updateMember: useCallback((id, updates) => data.updateMember(id, updates, clientId), [clientId]),
    deleteMember: useCallback((id) => data.deleteMember(id, clientId), [clientId]),
    authenticateUser: useCallback((email, password) => data.authenticateUser(email, password, clientId), [clientId]),

    getProjections: useCallback(() => data.getProjections(clientId), [clientId]),
    addProjection: useCallback((projection) => data.addProjection(projection, clientId), [clientId]),
    updateProjection: useCallback((id, updates) => data.updateProjection(id, updates, clientId), [clientId]),
    deleteProjection: useCallback((id) => data.deleteProjection(id, clientId), [clientId]),

    getProducts: useCallback(() => data.getProducts(clientId), [clientId]),
    addProduct: useCallback((product) => data.addProduct(product, clientId), [clientId]),
    updateProduct: useCallback((id, updates) => data.updateProduct(id, updates, clientId), [clientId]),
    deleteProduct: useCallback((id) => data.deleteProduct(id, clientId), [clientId]),

    getPaymentFees: useCallback(() => data.getPaymentFees(clientId), [clientId]),
    addPaymentFee: useCallback((fee) => data.addPaymentFee(fee, clientId), [clientId]),
    updatePaymentFee: useCallback((id, updates) => data.updatePaymentFee(id, updates, clientId), [clientId]),
    deletePaymentFee: useCallback((id) => data.deletePaymentFee(id, clientId), [clientId]),

    getN8nConfig: useCallback(() => data.getN8nConfig(clientId), [clientId]),
    saveN8nConfig: useCallback((config) => data.saveN8nConfig(config, clientId), [clientId]),

    importSaleFromClose: useCallback((d) => data.importSaleFromClose(d, clientId), [clientId]),

    // CEO Mind
    getCeoMeetings: useCallback(() => data.getCeoMeetings(clientId), [clientId]),
    addCeoMeeting: useCallback((meeting) => data.addCeoMeeting(meeting, clientId), [clientId]),
    updateCeoMeeting: useCallback((id, updates) => data.updateCeoMeeting(id, updates, clientId), [clientId]),
    deleteCeoMeeting: useCallback((id) => data.deleteCeoMeeting(id, clientId), [clientId]),

    getCeoProjects: useCallback(() => data.getCeoProjects(clientId), [clientId]),
    addCeoProject: useCallback((project) => data.addCeoProject(project, clientId), [clientId]),
    updateCeoProject: useCallback((id, updates) => data.updateCeoProject(id, updates, clientId), [clientId]),
    deleteCeoProject: useCallback((id) => data.deleteCeoProject(id, clientId), [clientId]),

    getCeoIdeas: useCallback(() => data.getCeoIdeas(clientId), [clientId]),
    addCeoIdea: useCallback((idea) => data.addCeoIdea(idea, clientId), [clientId]),
    updateCeoIdea: useCallback((id, updates) => data.updateCeoIdea(id, updates, clientId), [clientId]),
    deleteCeoIdea: useCallback((id) => data.deleteCeoIdea(id, clientId), [clientId]),

    getCeoDailyDigests: useCallback(() => data.getCeoDailyDigests(clientId), [clientId]),
    getCeoWeeklyDigests: useCallback(() => data.getCeoWeeklyDigests(clientId), [clientId]),

    getCeoTeamNotes: useCallback(() => data.getCeoTeamNotes(clientId), [clientId]),
    saveCeoTeamNote: useCallback((memberId, note) => data.saveCeoTeamNote(memberId, note, clientId), [clientId]),

    getCeoIntegrations: useCallback(() => data.getCeoIntegrations(clientId), [clientId]),
    saveCeoIntegration: useCallback((integration) => data.saveCeoIntegration(integration, clientId), [clientId]),

    // CEO Finance
    getCeoFinanceEntries: useCallback(() => data.getCeoFinanceEntries(clientId), [clientId]),
    addCeoFinanceEntry: useCallback((entry) => data.addCeoFinanceEntry(entry, clientId), [clientId]),
    updateCeoFinanceEntry: useCallback((id, updates) => data.updateCeoFinanceEntry(id, updates, clientId), [clientId]),
    deleteCeoFinanceEntry: useCallback((id) => data.deleteCeoFinanceEntry(id, clientId), [clientId]),
    getCeoFinanceSummary: useCallback((yearMonth) => data.getCeoFinanceSummary(clientId, yearMonth), [clientId]),

    // Commission Payments
    getCommissionPayments: useCallback(() => data.getCommissionPayments(clientId), [clientId]),
    upsertCommissionPayment: useCallback((payment) => data.upsertCommissionPayment(payment, clientId), [clientId]),
    toggleCommissionPaid: useCallback((paymentId, paid) => data.toggleCommissionPaid(paymentId, paid), [clientId]),

    // CRM
    getCrmContacts: useCallback(() => data.getCrmContacts(clientId), [clientId]),
    addCrmContact: useCallback((contact) => data.addCrmContact(contact, clientId), [clientId]),
    addCrmContacts: useCallback((contacts) => data.addCrmContacts(contacts, clientId), [clientId]),
    updateCrmContact: useCallback((id, updates) => data.updateCrmContact(id, updates, clientId), [clientId]),
    bulkUpdateCrmContacts: useCallback((ids, updates) => data.bulkUpdateCrmContacts(ids, updates, clientId), [clientId]),
    deleteCrmContact: useCallback((id) => data.deleteCrmContact(id, clientId), [clientId]),
    enrichContact: useCallback((id) => data.enrichContact(id, clientId), [clientId]),

    getCrmActivities: useCallback((contactId) => data.getCrmActivities(clientId, contactId), [clientId]),
    addCrmActivity: useCallback((activity) => data.addCrmActivity(activity, clientId), [clientId]),
    deleteCrmActivity: useCallback((id) => data.deleteCrmActivity(id, clientId), [clientId]),

    getCrmCustomFields: useCallback(() => data.getCrmCustomFields(clientId), [clientId]),
    addCrmCustomField: useCallback((field) => data.addCrmCustomField(field, clientId), [clientId]),
    updateCrmCustomField: useCallback((id, updates) => data.updateCrmCustomField(id, updates, clientId), [clientId]),
    deleteCrmCustomField: useCallback((id) => data.deleteCrmCustomField(id, clientId), [clientId]),

    getCrmSmartViews: useCallback(() => data.getCrmSmartViews(clientId), [clientId]),
    addCrmSmartView: useCallback((view) => data.addCrmSmartView(view, clientId), [clientId]),
    updateCrmSmartView: useCallback((id, updates) => data.updateCrmSmartView(id, updates, clientId), [clientId]),
    deleteCrmSmartView: useCallback((id) => data.deleteCrmSmartView(id, clientId), [clientId]),

    getCrmPipelines: useCallback(() => data.getCrmPipelines(clientId), [clientId]),
    addCrmPipeline: useCallback((pipeline) => data.addCrmPipeline(pipeline, clientId), [clientId]),
    updateCrmPipeline: useCallback((id, updates) => data.updateCrmPipeline(id, updates, clientId), [clientId]),

    // CRM Files
    getCrmFiles: useCallback((contactId) => data.getCrmFiles(clientId, contactId), [clientId]),
    addCrmFile: useCallback((file) => data.addCrmFile(file, clientId), [clientId]),
    deleteCrmFile: useCallback((id) => data.deleteCrmFile(id, clientId), [clientId]),

    // CRM Tasks
    getCrmTasks: useCallback((contactId) => data.getCrmTasks(clientId, contactId), [clientId]),
    addCrmTask: useCallback((task) => data.addCrmTask(task, clientId), [clientId]),
    updateCrmTask: useCallback((id, updates) => data.updateCrmTask(id, updates, clientId), [clientId]),
    deleteCrmTask: useCallback((id) => data.deleteCrmTask(id, clientId), [clientId]),

    // CRM Pipeline delete
    deleteCrmPipeline: useCallback((id) => data.deleteCrmPipeline(id, clientId), [clientId]),

    // Email Config
    getEmailConfig: useCallback(() => data.getEmailConfig(clientId), [clientId]),
    saveEmailConfig: useCallback((config) => data.saveEmailConfig(config, clientId), [clientId]),
    sendEmailCampaign: useCallback((campaignId) => data.sendEmailCampaign(campaignId, clientId), [clientId]),

    // Email Marketing
    getEmailLists: useCallback(() => data.getEmailLists(clientId), [clientId]),
    addEmailList: useCallback((list) => data.addEmailList(list, clientId), [clientId]),
    updateEmailList: useCallback((id, updates) => data.updateEmailList(id, updates, clientId), [clientId]),
    deleteEmailList: useCallback((id) => data.deleteEmailList(id), [clientId]),

    getEmailSubscribers: useCallback((listId) => data.getEmailSubscribers(clientId, listId), [clientId]),
    addEmailSubscriber: useCallback((sub) => data.addEmailSubscriber(sub, clientId), [clientId]),
    updateEmailSubscriber: useCallback((id, updates) => data.updateEmailSubscriber(id, updates), [clientId]),
    deleteEmailSubscriber: useCallback((id) => data.deleteEmailSubscriber(id), [clientId]),

    getEmailTemplates: useCallback(() => data.getEmailTemplates(clientId), [clientId]),
    addEmailTemplate: useCallback((tpl) => data.addEmailTemplate(tpl, clientId), [clientId]),
    updateEmailTemplate: useCallback((id, updates) => data.updateEmailTemplate(id, updates), [clientId]),
    deleteEmailTemplate: useCallback((id) => data.deleteEmailTemplate(id), [clientId]),

    getEmailCampaigns: useCallback(() => data.getEmailCampaigns(clientId), [clientId]),
    addEmailCampaign: useCallback((campaign) => data.addEmailCampaign(campaign, clientId), [clientId]),
    updateEmailCampaign: useCallback((id, updates) => data.updateEmailCampaign(id, updates), [clientId]),
    deleteEmailCampaign: useCallback((id) => data.deleteEmailCampaign(id), [clientId]),

    // ManyChat Config (Instagram DMs)
    getManychatConfig: useCallback(() => data.getManychatConfig(clientId), [clientId]),
    saveManychatConfig: useCallback((config) => data.saveManychatConfig(config, clientId), [clientId]),
    syncManychatSubscribers: useCallback(() => data.syncManychatSubscribers(clientId), [clientId]),
    syncManychatToCrm: useCallback((contactIds) => data.syncManychatToCrm(contactIds, clientId), [clientId]),

    // WhatsApp Config (per-client)
    getWhatsappConfig: useCallback(() => data.getWhatsappConfig(clientId), [clientId]),
    saveWhatsappConfig: useCallback((config) => data.saveWhatsappConfig(config, clientId), [clientId]),
    sendWhatsappMessage: useCallback((to, message) => data.sendWhatsappMessage(to, message, clientId), [clientId]),

    // Installment Plans (Pagos a Plazos)
    getInstallmentPlans: useCallback(() => data.getInstallmentPlans(clientId), [clientId]),
    addInstallmentPlan: useCallback((plan) => data.addInstallmentPlan(plan, clientId), [clientId]),
    updateInstallmentPlan: useCallback((id, updates) => data.updateInstallmentPlan(id, updates, clientId), [clientId]),
    deleteInstallmentPlan: useCallback((id) => data.deleteInstallmentPlan(id, clientId), [clientId]),
    getInstallmentPayments: useCallback((planId) => data.getInstallmentPayments(planId), [clientId]),
    updateInstallmentPayment: useCallback((id, updates) => data.updateInstallmentPayment(id, updates), [clientId]),
    createInstallmentPlanWithPayments: useCallback((plan) => data.createInstallmentPlanWithPayments(plan, clientId), [clientId]),

    // Stores (Gestión de Tiendas)
    getStores: useCallback(() => data.getStores(clientId), [clientId]),
    addStore: useCallback((store) => data.addStore(store, clientId), [clientId]),
    updateStore: useCallback((id, updates) => data.updateStore(id, updates, clientId), [clientId]),
    deleteStore: useCallback((id) => data.deleteStore(id, clientId), [clientId]),

    getStoreSteps: useCallback((storeId) => data.getStoreSteps(storeId), [clientId]),
    updateStoreStep: useCallback((id, updates) => data.updateStoreStep(id, updates), [clientId]),
    initStoreSteps: useCallback((storeId, serviceType) => data.initStoreSteps(storeId, serviceType), [clientId]),

    getStoreAlerts: useCallback((resolved) => data.getStoreAlerts(clientId, resolved), [clientId]),
    addStoreAlert: useCallback((alert) => data.addStoreAlert(alert, clientId), [clientId]),
    resolveStoreAlert: useCallback((id, resolvedBy, note) => data.resolveStoreAlert(id, resolvedBy, note), [clientId]),

    getStoreDailyTracking: useCallback((storeId) => data.getStoreDailyTracking(storeId), [clientId]),
    addStoreDailyTracking: useCallback((entry) => data.addStoreDailyTracking(entry), [clientId]),

    getStoreHistory: useCallback((storeId) => data.getStoreHistory(storeId), [clientId]),
    addStoreHistory: useCallback((entry) => data.addStoreHistory(entry), [clientId]),

    // Store Clients (portal users)
    authenticateStoreClient: useCallback((email, password) => data.authenticateStoreClient(email, password, clientId), [clientId]),
    getStoreClients: useCallback(() => data.getStoreClients(clientId), [clientId]),
    addStoreClient: useCallback((client) => data.addStoreClient(client, clientId), [clientId]),
    updateStoreClient: useCallback((id, updates) => data.updateStoreClient(id, updates, clientId), [clientId]),

    // Store Tickets
    getStoreTickets: useCallback((filters) => data.getStoreTickets(clientId, filters), [clientId]),
    addStoreTicket: useCallback((ticket) => data.addStoreTicket(ticket, clientId), [clientId]),
    updateStoreTicket: useCallback((id, updates) => data.updateStoreTicket(id, updates), [clientId]),

    // Ticket Messages
    getTicketMessages: useCallback((ticketId) => data.getTicketMessages(ticketId), [clientId]),
    addTicketMessage: useCallback((message) => data.addTicketMessage(message), [clientId]),

    // Store Creation Orchestrator
    createStoreWithClient: useCallback((params) => data.createStoreWithClient(params, clientId), [clientId]),

    // Chatbot / ManyChat
    getChatFlows: useCallback(() => data.getChatFlows(clientId), [clientId]),
    addChatFlow: useCallback((flow) => data.addChatFlow(flow, clientId), [clientId]),
    updateChatFlow: useCallback((id, updates) => data.updateChatFlow(id, updates), [clientId]),
    deleteChatFlow: useCallback((id) => data.deleteChatFlow(id), [clientId]),

    getChatContacts: useCallback(() => data.getChatContacts(clientId), [clientId]),
    addChatContact: useCallback((contact) => data.addChatContact(contact, clientId), [clientId]),
    updateChatContact: useCallback((id, updates) => data.updateChatContact(id, updates), [clientId]),
    deleteChatContact: useCallback((id) => data.deleteChatContact(id), [clientId]),

    getChatConversations: useCallback(() => data.getChatConversations(clientId), [clientId]),
    addChatConversation: useCallback((conv) => data.addChatConversation(conv, clientId), [clientId]),
    updateChatConversation: useCallback((id, updates) => data.updateChatConversation(id, updates), [clientId]),

    getChatMessages: useCallback((convId) => data.getChatMessages(clientId, convId), [clientId]),
    addChatMessage: useCallback((msg) => data.addChatMessage(msg, clientId), [clientId]),

    getChatBroadcasts: useCallback(() => data.getChatBroadcasts(clientId), [clientId]),
    addChatBroadcast: useCallback((broadcast) => data.addChatBroadcast(broadcast, clientId), [clientId]),
    updateChatBroadcast: useCallback((id, updates) => data.updateChatBroadcast(id, updates), [clientId]),
    deleteChatBroadcast: useCallback((id) => data.deleteChatBroadcast(id), [clientId]),

    // AI Agent Chat
    getAgentConversations: useCallback(() => data.getAgentConversations(clientId), [clientId]),
    addAgentConversation: useCallback((conv) => data.addAgentConversation(conv, clientId), [clientId]),
    updateAgentConversation: useCallback((id, updates) => data.updateAgentConversation(id, updates, clientId), [clientId]),
    deleteAgentConversation: useCallback((id) => data.deleteAgentConversation(id, clientId), [clientId]),
    getAgentMessages: useCallback((convId) => data.getAgentMessages(convId), [clientId]),
    addAgentMessage: useCallback((msg) => data.addAgentMessage(msg, clientId), [clientId]),
  }
}
