import { useState } from 'react';
import { MapPin, X, Loader } from 'lucide-react';

export default function AddressForm({ onSave, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone_number: '',
        street_address: '',
        city: '',
        state: '',
        pincode: '',
        address_type: 'warehouse'
    });

    // 🛰️ THE GPS MAGIC
    const handleUseLocation = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }

        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    // Use OpenStreetMap to convert GPS -> Address (Reverse Geocoding)
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                    );
                    const data = await response.json();

                    const address = data.address || {};

                    setFormData(prev => ({
                        ...prev,
                        street_address: `${address.road || ''}, ${address.suburb || ''}`.replace(/^, /, ''),
                        city: address.city || address.town || address.village || '',
                        state: address.state || '',
                        pincode: address.postcode || '',
                        // We save the coordinates too!
                        latitude: latitude,
                        longitude: longitude
                    }));
                } catch (error) {
                    console.error("Failed to fetch address from GPS", error);
                    alert("Could not detect address. Please enter manually.");
                } finally {
                    setGpsLoading(false);
                }
            },
            (error) => {
                console.error(error);
                alert("Unable to retrieve your location. Check browser permissions.");
                setGpsLoading(false);
            }
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        // Send data back to parent
        onSave(formData).catch(() => setLoading(false));
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">Add New Address</h3>
                    <button onClick={onCancel} className="p-1 hover:bg-gray-200 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">

                    {/* GPS BUTTON */}
                    <button
                        type="button"
                        onClick={handleUseLocation}
                        disabled={gpsLoading}
                        className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-700 py-3 rounded-lg font-medium hover:bg-blue-100 transition-colors border border-blue-200"
                    >
                        {gpsLoading ? (
                            <Loader className="w-5 h-5 animate-spin" />
                        ) : (
                            <MapPin className="w-5 h-5" />
                        )}
                        {gpsLoading ? "Detecting Location..." : "Use My Current Location"}
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Location Name</label>
                            <input
                                required
                                placeholder="e.g. Main Warehouse"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
                            <input
                                required
                                placeholder="+91..."
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                value={formData.phone_number}
                                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Street Address</label>
                        <textarea
                            required
                            rows="2"
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            value={formData.street_address}
                            onChange={e => setFormData({ ...formData, street_address: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
                            <input
                                required
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                value={formData.city}
                                onChange={e => setFormData({ ...formData, city: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Pincode</label>
                            <input
                                required
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                value={formData.pincode}
                                onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
                        <input
                            required
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            value={formData.state}
                            onChange={e => setFormData({ ...formData, state: e.target.value })}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50"
                        >
                            {loading ? 'Saving Address...' : 'Save Address'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}