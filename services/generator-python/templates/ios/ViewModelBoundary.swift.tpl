import Foundation

protocol ViewModelBoundary: ObservableObject {
    associatedtype State
    var state: State { get }
}
