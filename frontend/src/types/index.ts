export interface Asset {
  inventoryNo: string
  typeId: number
  manufacturer: string
  model: string
  serialNumber: string
  purchaseDate: string
  cost: number
  statusId: number
  vendorName: string | null
  receiptActNo: string | null
}

export interface Ticket {
  ticketNo: string
  type: string
  category: string | null
  authorEmployeeNo: string
  assigneeEmployeeNo: string | null
  assetInventoryNo: string | null
  softwareId: number | null
  targetSoftwareVersion: string | null
  justification: string | null
  comment: string | null
  createdAt: string
  closedAt: string | null
  statusId: number
}

export interface AmortizationGroup {
  groupNo: number
  description: string
  minUsefulLifeMonths: number
  maxUsefulLifeMonths: number | null
}

export interface OkofCode {
  code: string
  name: string
  amortizationGroup: AmortizationGroup
}

export interface AssetType {
  id: number
  name: string
  defaultUsefulLifeYears: number
  okof: OkofCode | null
  okofCode: string | null
  amortizationGroupNo: number | null
}

export interface AssetStatus {
  id: number
  name: string
}

export interface TicketStatus {
  id: number
  name: string
}

export interface Employee {
  employeeNo: string
  lastName: string
  firstName: string
  patronymic: string | null
  fullName: string
  position: string
  department: string
  login: string
  roleId: number
}

export interface Role {
  id: number
  name: string
}

export interface Notification {
  id: number
  recipientEmployeeNo: string
  createdAt: string
  type: string
  title: string
  body: string
  relatedTicketNo: string | null
  read: boolean
}

export interface MeResponse {
  employeeNo: string
  fullName: string
  role: string
}

export interface AssetMovementAct {
  actNo: string
  assetInventoryNo: string
  employeeNo: string
  movementType: 'ISSUE' | 'RETURN'
  movementDate: string
  actorEmployeeNo: string | null
  relatedActNo: string | null
}

export interface AssetWriteOffAct {
  actNo: string
  assetInventoryNo: string
  reason: string
  writeOffDate: string
}

export interface SystemLog {
  id: number
  loggedAt: string
  actorEmployeeNo: string | null
  action: string
  details: string | null
}

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
